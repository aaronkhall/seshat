import Fastify from 'fastify';

// Load repo-root .env (running cwd is api/ under npm workspaces) without a dep.
for (const p of ['../.env', '.env']) {
  try {
    process.loadEnvFile(p);
    break;
  } catch {
    /* not found — try next */
  }
}

const PORT = Number(process.env.API_PORT ?? 8787);
const TF_KEY = process.env.THUNDERFOREST_API_KEY ?? '';
const OWM_KEY = process.env.OPENWEATHERMAP_API_KEY ?? '';

// Allowlists so the proxy can't be turned into an open relay.
const TF_STYLES = new Set(['outdoors', 'cycle', 'landscape', 'transport', 'atlas', 'spinal-map']);
const OWM_LAYERS = new Set([
  'precipitation_new',
  'wind_new',
  'clouds_new',
  'temp_new',
  'pressure_new',
  'rain',
  'snow',
]);

const app = Fastify({ logger: true });

app.get('/api/health', async () => ({ ok: true }));

// Which keyed sources are configured — the web app uses this to enable/disable layers.
app.get('/api/keys', async () => ({
  thunderforest: Boolean(TF_KEY),
  openweathermap: Boolean(OWM_KEY),
}));

const NUM = /^\d{1,2}$/;
const COORD = /^\d{1,7}$/;

async function pipeTile(reply: import('fastify').FastifyReply, url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      reply.code(res.status).send();
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    reply
      .header('content-type', res.headers.get('content-type') ?? 'image/png')
      .header('cache-control', 'public, max-age=86400')
      .send(buf);
  } catch (err) {
    reply.code(502).send({ error: 'upstream fetch failed', detail: String(err) });
  }
}

// Thunderforest: https://tile.thunderforest.com/{style}/{z}/{x}/{y}.png?apikey=KEY
app.get<{ Params: { style: string; z: string; x: string; y: string } }>(
  '/api/tiles/thunderforest/:style/:z/:x/:y.png',
  async (req, reply) => {
    const { style, z, x, y } = req.params;
    if (!TF_KEY) return reply.code(503).send({ error: 'Thunderforest key not configured' });
    if (!TF_STYLES.has(style) || !NUM.test(z) || !COORD.test(x) || !COORD.test(y)) {
      return reply.code(400).send({ error: 'bad tile request' });
    }
    await pipeTile(
      reply,
      `https://tile.thunderforest.com/${style}/${z}/${x}/${y}.png?apikey=${TF_KEY}`,
    );
  },
);

// RainViewer radar — keyless, but proxied because its tile CDN sends no CORS headers
// (MapLibre fetches raster tiles with CORS, unlike Leaflet's <img> tags).
// path is a frame path from weather-maps.json, e.g. /v2/radar/1700000000 or /v2/radar/nowcast_xyz
const RV_PATH = /^\/v2\/radar\/[\w]+$/;
const RV_SIZE = 256;
const RV_COLOR = 4;
const RV_OPTS = '1_1'; // smooth_snow
app.get<{ Params: { z: string; x: string; y: string }; Querystring: { path?: string } }>(
  '/api/tiles/rainviewer/:z/:x/:y.png',
  async (req, reply) => {
    const { z, x, y } = req.params;
    const path = req.query.path ?? '';
    if (!RV_PATH.test(path) || !NUM.test(z) || !COORD.test(x) || !COORD.test(y)) {
      return reply.code(400).send({ error: 'bad tile request' });
    }
    await pipeTile(
      reply,
      `https://tilecache.rainviewer.com${path}/${RV_SIZE}/${z}/${x}/${y}/${RV_COLOR}/${RV_OPTS}.png`,
    );
  },
);

// OpenWeatherMap: https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png?appid=KEY
app.get<{ Params: { layer: string; z: string; x: string; y: string } }>(
  '/api/tiles/owm/:layer/:z/:x/:y.png',
  async (req, reply) => {
    const { layer, z, x, y } = req.params;
    if (!OWM_KEY) return reply.code(503).send({ error: 'OpenWeatherMap key not configured' });
    if (!OWM_LAYERS.has(layer) || !NUM.test(z) || !COORD.test(x) || !COORD.test(y)) {
      return reply.code(400).send({ error: 'bad tile request' });
    }
    await pipeTile(
      reply,
      `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${OWM_KEY}`,
    );
  },
);

app
  .listen({ port: PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`tile proxy on :${PORT} (thunderforest=${!!TF_KEY} owm=${!!OWM_KEY})`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
