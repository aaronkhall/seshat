// Engine-agnostic routing. The web app posts waypoints + a profile to /api/route;
// this module asks a routing engine to snap them to the network and returns a
// normalized shape. The engine is chosen by env so the user's self-hosted
// GraphHopper drops in for production (native elevation + surface), while dev
// falls back to the keyless public FOSSGIS OSRM servers + a public DEM.

export type Profile = 'bike' | 'foot' | 'car';

export interface RouteRequest {
  profile: Profile;
  /** [lng, lat] waypoints in order. */
  points: [number, number][];
  /** Include an elevation profile (engine-native, else DEM-sampled). */
  elevation?: boolean;
}

export interface SurfaceSpan {
  from: number; // coordinate index
  to: number; // coordinate index
  value: string; // e.g. paved, gravel, dirt, unknown
}

export interface NormalizedRoute {
  engine: string;
  profile: Profile;
  distance: number; // metres
  duration: number; // seconds
  /** Full geometry [lng, lat] (no elevation — that lives in elevationProfile). */
  coordinates: [number, number][];
  bbox: [number, number, number, number]; // [w, s, e, n]
  /** Sampled distance/elevation pairs for the chart (<=200 pts). Empty if unavailable. */
  elevationProfile: { dist: number; ele: number }[];
  ascent: number;
  descent: number;
  /** Per-span surface classification (GraphHopper only for now). */
  surfaces: SurfaceSpan[];
}

// GraphHopper: either a self-hosted instance (GRAPHHOPPER_URL) or the public
// Directions API (GRAPHHOPPER_KEY). With a key, GraphHopper is used WORLDWIDE
// (elevation + surface everywhere); the self-hosted path is regional (bbox) + OSRM.
const GRAPHHOPPER_KEY = process.env.GRAPHHOPPER_KEY ?? '';
const GRAPHHOPPER_PUBLIC = 'https://graphhopper.com/api/1';
const GRAPHHOPPER_URL =
  process.env.GRAPHHOPPER_URL || (GRAPHHOPPER_KEY ? GRAPHHOPPER_PUBLIC : '');

// Region the self-hosted GraphHopper graph covers. Points inside use GraphHopper
// (native elevation + surface); anything outside (or crossing the edge) uses public
// OSRM. Override with GRAPHHOPPER_BBOX="w,s,e,n". Default is Australia (incl. Tasmania).
const DEFAULT_AU_BBOX: [number, number, number, number] = [112, -44, 154, -9];
function parseBbox(s: string | undefined): [number, number, number, number] | null {
  if (!s) return null;
  const p = s.split(',').map(Number);
  return p.length === 4 && p.every((n) => Number.isFinite(n))
    ? [p[0], p[1], p[2], p[3]]
    : null;
}
const GRAPHHOPPER_BBOX = parseBbox(process.env.GRAPHHOPPER_BBOX) ?? DEFAULT_AU_BBOX;

function withinBbox(points: [number, number][], [w, s, e, n]: [number, number, number, number]): boolean {
  return points.every(([lng, lat]) => lng >= w && lng <= e && lat >= s && lat <= n);
}
// FOSSGIS public OSRM — one host per profile, keyless. Dev fallback.
const OSRM_HOSTS: Record<Profile, string> = {
  bike: 'https://routing.openstreetmap.de/routed-bike',
  foot: 'https://routing.openstreetmap.de/routed-foot',
  car: 'https://routing.openstreetmap.de/routed-car',
};
// Public DEM for elevation enrichment when the engine has none.
const OPENTOPODATA = 'https://api.opentopodata.org/v1/mapzen';

/** What the client should know: 'graphhopper' (worldwide, via key), 'hybrid' (GH in-region + OSRM), or 'osrm'. */
export function routingInfo(): {
  routingEngine: string;
  selfHostedBbox: [number, number, number, number] | null;
} {
  if (GRAPHHOPPER_KEY) return { routingEngine: 'graphhopper', selfHostedBbox: null };
  if (GRAPHHOPPER_URL) return { routingEngine: 'hybrid', selfHostedBbox: GRAPHHOPPER_BBOX };
  return { routingEngine: 'osrm', selfHostedBbox: null };
}

const R = 6371000;
function haversine(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bboxOf(coords: [number, number][]): [number, number, number, number] {
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < w) w = lng;
    if (lng > e) e = lng;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return [w, s, e, n];
}

/** Cumulative distance (m) at each coordinate. */
function cumulativeDistances(coords: [number, number][]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) out.push(out[i - 1] + haversine(coords[i - 1], coords[i]));
  return out;
}

function ascentDescent(profile: { ele: number }[]): { ascent: number; descent: number } {
  let ascent = 0,
    descent = 0;
  for (let i = 1; i < profile.length; i++) {
    const d = profile[i].ele - profile[i - 1].ele;
    if (d > 0) ascent += d;
    else descent -= d;
  }
  return { ascent: Math.round(ascent), descent: Math.round(descent) };
}

// ---- GraphHopper ----
async function routeGraphHopper(req: RouteRequest): Promise<NormalizedRoute> {
  const body = {
    points: req.points, // GraphHopper accepts [lng,lat]
    profile: req.profile,
    elevation: req.elevation ?? true,
    points_encoded: false,
    instructions: false,
    details: ['surface', 'road_class'],
  };
  const url = `${GRAPHHOPPER_URL}/route${GRAPHHOPPER_KEY ? `?key=${GRAPHHOPPER_KEY}` : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GraphHopper ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    paths: {
      distance: number;
      time: number;
      points: { coordinates: number[][] };
      bbox?: number[];
      details?: { surface?: [number, number, string][] };
    }[];
  };
  const path = data.paths[0];
  const raw = path.points.coordinates as number[][];
  const coordinates = raw.map((c) => [c[0], c[1]] as [number, number]);
  const cum = cumulativeDistances(coordinates);
  const hasEle = raw[0]?.length >= 3;
  const elevationProfile = hasEle ? sampleProfile(raw.map((c) => c[2] ?? 0), cum) : [];
  const surfaces: SurfaceSpan[] = (path.details?.surface ?? []).map(([from, to, value]) => ({
    from,
    to,
    value: value || 'unknown',
  }));
  return {
    engine: 'graphhopper',
    profile: req.profile,
    distance: path.distance,
    duration: path.time / 1000,
    coordinates,
    bbox: (path.bbox as [number, number, number, number]) ?? bboxOf(coordinates),
    elevationProfile,
    ...ascentDescent(elevationProfile),
    surfaces,
  };
}

// ---- OSRM (FOSSGIS public, dev fallback) ----
async function routeOSRM(req: RouteRequest): Promise<NormalizedRoute> {
  const host = OSRM_HOSTS[req.profile];
  const coords = req.points.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url = `${host}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    routes: { distance: number; duration: number; geometry: { coordinates: number[][] } }[];
  };
  if (!data.routes?.length) throw new Error('OSRM: no route');
  const route = data.routes[0];
  const coordinates = route.geometry.coordinates.map((c) => [c[0], c[1]] as [number, number]);
  let elevationProfile: { dist: number; ele: number }[] = [];
  if (req.elevation) {
    try {
      elevationProfile = await sampleElevation(coordinates);
    } catch {
      /* DEM optional — chart just stays empty */
    }
  }
  return {
    engine: 'osrm',
    profile: req.profile,
    distance: route.distance,
    duration: route.duration,
    coordinates,
    bbox: bboxOf(coordinates),
    elevationProfile,
    ...ascentDescent(elevationProfile),
    surfaces: [],
  };
}

/** Downsample a per-coordinate elevation array to <=200 {dist,ele} points. */
function sampleProfile(eles: number[], cum: number[]): { dist: number; ele: number }[] {
  const n = eles.length;
  if (n === 0) return [];
  const MAX = 200;
  const step = Math.max(1, Math.ceil(n / MAX));
  const out: { dist: number; ele: number }[] = [];
  for (let i = 0; i < n; i += step) out.push({ dist: cum[i], ele: eles[i] });
  if (out[out.length - 1].dist !== cum[n - 1]) out.push({ dist: cum[n - 1], ele: eles[n - 1] });
  return out;
}

/** Sample geometry at <=100 evenly spaced points and look up elevation from a public DEM. */
async function sampleElevation(coords: [number, number][]): Promise<{ dist: number; ele: number }[]> {
  const cum = cumulativeDistances(coords);
  const total = cum[cum.length - 1];
  const N = Math.min(100, coords.length);
  if (total === 0 || N < 2) return [];
  // pick N points evenly by distance
  const targets: { dist: number; coord: [number, number] }[] = [];
  let j = 0;
  for (let k = 0; k < N; k++) {
    const d = (total * k) / (N - 1);
    while (j < cum.length - 1 && cum[j] < d) j++;
    targets.push({ dist: d, coord: coords[Math.min(j, coords.length - 1)] });
  }
  const locs = targets.map((t) => `${t.coord[1]},${t.coord[0]}`).join('|');
  const res = await fetch(`${OPENTOPODATA}?locations=${locs}`);
  if (!res.ok) throw new Error(`opentopodata ${res.status}`);
  const data = (await res.json()) as { results?: { elevation: number | null }[] };
  const results = data.results ?? [];
  return targets.map((t, i) => ({ dist: t.dist, ele: results[i]?.elevation ?? 0 }));
}

export async function route(req: RouteRequest): Promise<NormalizedRoute> {
  if (req.points.length < 2) throw new Error('need at least 2 points');
  // Public GraphHopper API (key): use it worldwide — elevation + surface everywhere.
  if (GRAPHHOPPER_KEY) return routeGraphHopper(req);
  // Self-hosted GraphHopper: only when every point is inside its region, else OSRM.
  if (GRAPHHOPPER_URL && withinBbox(req.points, GRAPHHOPPER_BBOX)) {
    try {
      return await routeGraphHopper(req);
    } catch {
      return routeOSRM(req);
    }
  }
  return routeOSRM(req);
}
