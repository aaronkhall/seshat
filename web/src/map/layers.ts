// The layer catalog — the single source of truth for every map layer Seshat
// can show. Free / open sources only. Keyed sources point at the api tile proxy
// (/api/tiles/...) so API keys never reach the browser.
//
// Add new layers here; the UI is generated from this list.

export type LayerKind = 'base' | 'overlay';

export interface LayerDef {
  /** Stable id, also used as the MapLibre source/layer id. */
  id: string;
  name: string;
  kind: LayerKind;
  /** Grouping in the layer picker. */
  category: string;
  /** XYZ tile URL template(s). MapLibre round-robins multiple. Order of {x}/{y}/{z} in the string is respected. */
  tiles: string[];
  tileSize?: number;
  minzoom?: number;
  maxzoom?: number;
  /** Shown in the attribution control while this layer is active. HTML allowed. */
  attribution: string;
  /** Keyed source proxied by the api. If set and the key is missing, the layer is shown as unavailable. */
  requiresKey?: 'thunderforest' | 'openweathermap';
  /** Special animated source resolved at runtime (tiles change per frame). */
  dynamic?: 'rainviewer';
  /** Default opacity (0–1) when first added. */
  defaultOpacity?: number;
  /** Short note shown in the picker. */
  note?: string;
}

export const CATALOG: LayerDef[] = [
  // ---- Street ----
  {
    id: 'osm',
    name: 'OpenStreetMap',
    kind: 'base',
    category: 'Street',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    maxzoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },

  // ---- Satellite ----
  {
    id: 'esri-imagery',
    name: 'Esri World Imagery',
    kind: 'base',
    category: 'Satellite',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    maxzoom: 19,
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics — Powered by Esri',
    note: 'Best free global satellite',
  },
  {
    id: 'sentinel2',
    name: 'Sentinel-2 cloudless',
    kind: 'base',
    category: 'Satellite',
    tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
    maxzoom: 16,
    attribution: 'Sentinel-2 cloudless 2020 by <a href="https://s2maps.eu">EOX IT Services</a> (CC BY-NC-SA)',
    note: 'Cloud-free global mosaic',
  },

  // ---- Topo / Outdoors ----
  {
    id: 'opentopomap',
    name: 'OpenTopoMap',
    kind: 'base',
    category: 'Topo',
    tiles: [
      'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
    ],
    maxzoom: 17,
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Style: <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    note: 'Contour topo, keyless',
  },
  {
    id: 'usgs-topo',
    name: 'USGS Topo (US)',
    kind: 'base',
    category: 'Topo',
    tiles: ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}'],
    maxzoom: 16,
    attribution: 'USGS The National Map (public domain)',
    note: 'United States only',
  },
  {
    id: 'tf-outdoors',
    name: 'Thunderforest Outdoors',
    kind: 'base',
    category: 'Topo',
    tiles: ['/api/tiles/thunderforest/outdoors/{z}/{x}/{y}.png'],
    maxzoom: 22,
    attribution: 'Maps &copy; <a href="https://www.thunderforest.com">Thunderforest</a>, Data &copy; OpenStreetMap contributors',
    requiresKey: 'thunderforest',
    note: 'Needs free Thunderforest key',
  },
  {
    id: 'tf-cycle',
    name: 'OpenCycleMap',
    kind: 'base',
    category: 'Topo',
    tiles: ['/api/tiles/thunderforest/cycle/{z}/{x}/{y}.png'],
    maxzoom: 22,
    attribution: 'Maps &copy; <a href="https://www.thunderforest.com">Thunderforest</a>, Data &copy; OpenStreetMap contributors',
    requiresKey: 'thunderforest',
    note: 'Needs free Thunderforest key',
  },
  {
    id: 'tf-landscape',
    name: 'Thunderforest Landscape',
    kind: 'base',
    category: 'Topo',
    tiles: ['/api/tiles/thunderforest/landscape/{z}/{x}/{y}.png'],
    maxzoom: 22,
    attribution: 'Maps &copy; <a href="https://www.thunderforest.com">Thunderforest</a>, Data &copy; OpenStreetMap contributors',
    requiresKey: 'thunderforest',
    note: 'Needs free Thunderforest key',
  },

  // ---- Weather (overlays) ----
  {
    id: 'rainviewer-radar',
    name: 'Radar (animated)',
    kind: 'overlay',
    category: 'Weather',
    tiles: [], // resolved at runtime from the RainViewer frame timeline
    dynamic: 'rainviewer',
    maxzoom: 18,
    attribution: 'Radar &copy; <a href="https://www.rainviewer.com">RainViewer</a>',
    defaultOpacity: 0.75,
    note: 'Global precipitation radar, keyless',
  },
  {
    id: 'owm-precipitation',
    name: 'Precipitation',
    kind: 'overlay',
    category: 'Weather',
    tiles: ['/api/tiles/owm/precipitation_new/{z}/{x}/{y}.png'],
    maxzoom: 19,
    attribution: 'Weather &copy; <a href="https://openweathermap.org">OpenWeatherMap</a>',
    requiresKey: 'openweathermap',
    defaultOpacity: 0.7,
    note: 'Needs free OpenWeatherMap key',
  },
  {
    id: 'owm-wind',
    name: 'Wind',
    kind: 'overlay',
    category: 'Weather',
    tiles: ['/api/tiles/owm/wind_new/{z}/{x}/{y}.png'],
    maxzoom: 19,
    attribution: 'Weather &copy; <a href="https://openweathermap.org">OpenWeatherMap</a>',
    requiresKey: 'openweathermap',
    defaultOpacity: 0.6,
    note: 'Needs free OpenWeatherMap key',
  },
  {
    id: 'owm-clouds',
    name: 'Clouds',
    kind: 'overlay',
    category: 'Weather',
    tiles: ['/api/tiles/owm/clouds_new/{z}/{x}/{y}.png'],
    maxzoom: 19,
    attribution: 'Weather &copy; <a href="https://openweathermap.org">OpenWeatherMap</a>',
    requiresKey: 'openweathermap',
    defaultOpacity: 0.6,
    note: 'Needs free OpenWeatherMap key',
  },
  {
    id: 'owm-temp',
    name: 'Temperature',
    kind: 'overlay',
    category: 'Weather',
    tiles: ['/api/tiles/owm/temp_new/{z}/{x}/{y}.png'],
    maxzoom: 19,
    attribution: 'Weather &copy; <a href="https://openweathermap.org">OpenWeatherMap</a>',
    requiresKey: 'openweathermap',
    defaultOpacity: 0.6,
    note: 'Needs free OpenWeatherMap key',
  },
];

export const CATALOG_BY_ID: Record<string, LayerDef> = Object.fromEntries(
  CATALOG.map((l) => [l.id, l]),
);

/** Catalog grouped by category, preserving first-seen order. */
export function catalogByCategory(): { category: string; layers: LayerDef[] }[] {
  const groups: { category: string; layers: LayerDef[] }[] = [];
  for (const l of CATALOG) {
    let g = groups.find((x) => x.category === l.category);
    if (!g) {
      g = { category: l.category, layers: [] };
      groups.push(g);
    }
    g.layers.push(l);
  }
  return groups;
}
