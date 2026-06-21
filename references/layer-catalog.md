# Layer catalog — sources, terms, access

The authoritative list lives as typed data in [`web/src/map/layers.ts`](../web/src/map/layers.ts).
This doc records the *why* — access method, licensing, and gotchas. Free / open
sources only. Keyed sources are proxied by the api so keys never reach the browser.

## Base layers

| Layer | Source | Access | Terms / gotchas |
|---|---|---|---|
| OpenStreetMap | tile.openstreetmap.org | Keyless XYZ | Light use only; **no bulk/offline caching** (policy). Attribution required. |
| Esri World Imagery | server.arcgisonline.com | Keyless XYZ (`/{z}/{y}/{x}`) | Free **only while zero-revenue**; "Powered by Esri" attribution. Adding ads/subscriptions = commercial license. |
| Sentinel-2 cloudless | tiles.maps.eox.at (EOX) | Keyless WMTS/XYZ | Cloud-free global mosaic. Attribution: "Sentinel-2 cloudless by EOX". CC BY-NC-SA. |
| OpenTopoMap | {a,b,c}.tile.opentopomap.org | Keyless XYZ | CC-BY-SA; "low volume" <500k tiles/mo. Subdomains a/b/c round-robin. |
| USGS Topo | basemap.nationalmap.gov | Keyless XYZ (`/{z}/{y}/{x}`) | Public domain. **US only.** |
| Thunderforest Outdoors / Cycle / Landscape | tile.thunderforest.com | **Key** (free Hobby, 150k/mo) | Proxied via `/api/tiles/thunderforest/...`. Attribution required. |

## Weather overlays

| Layer | Source | Access | Notes |
|---|---|---|---|
| Radar (animated) | RainViewer | Keyless, **proxied** | Tile CDN sends no CORS headers → must proxy for MapLibre (`/api/tiles/rainviewer/...`). Timeline from `weather-maps.json`. |
| Precipitation / Wind / Clouds / Temperature | OpenWeatherMap | **Key** (free, 1M/mo) | Proxied via `/api/tiles/owm/{layer}/...`. |

## Key gotchas baked into the design

1. **No Google / Bing self-rendered tiles** — Google's ToS forbids it + bans offline caching; Bing is retiring (EOL 2028).
2. **CORS**: MapLibre fetches raster tiles with CORS (unlike Leaflet's `<img>`). Sources without CORS headers (RainViewer) are proxied by the api.
3. **Attribution is mandatory** for OSM, OpenTopoMap, Esri, EOX, Thunderforest, RainViewer, OpenWeatherMap — shown in the in-app attribution control, fed from each layer's `attribution` field.
4. **Free-tier conditions**: Esri (zero-revenue), Sentinel-2/RainViewer (personal/non-commercial) — fine for this private app, not for a product.

## Adding a layer

Add an entry to `CATALOG` in `web/src/map/layers.ts`. For a keyed source, route its
`tiles` through `/api/tiles/...`, add the allowlist + proxy route in
`api/src/server.ts`, set `requiresKey`, and record the terms here.
