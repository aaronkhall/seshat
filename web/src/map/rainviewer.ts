// RainViewer animated radar. Free, keyless. The weather-maps.json endpoint returns
// a timeline of past + nowcast radar frames; each frame is a tile path we turn into
// an XYZ template. Animation = stepping the active frame.
// Docs: https://www.rainviewer.com/api.html

export interface RadarFrame {
  time: number; // unix seconds
  path: string; // e.g. /v2/radar/1700000000
}

export interface RadarTimeline {
  past: RadarFrame[];
  nowcast: RadarFrame[];
  /** past followed by nowcast — the full playable sequence. */
  frames: RadarFrame[];
}

const WEATHER_MAPS_URL = 'https://api.rainviewer.com/public/weather-maps.json';

export async function fetchRadarTimeline(): Promise<RadarTimeline> {
  const res = await fetch(WEATHER_MAPS_URL);
  if (!res.ok) throw new Error(`RainViewer ${res.status}`);
  const data = (await res.json()) as {
    radar?: { past?: RadarFrame[]; nowcast?: RadarFrame[] };
  };
  const past = data.radar?.past ?? [];
  const nowcast = data.radar?.nowcast ?? [];
  return { past, nowcast, frames: [...past, ...nowcast] };
}

/**
 * XYZ tile template for one radar frame. Routed through the api proxy because
 * RainViewer's tile CDN sends no CORS headers and MapLibre fetches raster tiles
 * with CORS. The proxy applies size/color/options server-side.
 */
export function frameTiles(_timeline: RadarTimeline, frame: RadarFrame): string[] {
  return [`/api/tiles/rainviewer/{z}/{x}/{y}.png?path=${encodeURIComponent(frame.path)}`];
}

export function formatFrameTime(frame: RadarFrame): string {
  const d = new Date(frame.time * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
