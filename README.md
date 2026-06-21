# Seshat

*Named for the Egyptian goddess of surveying, measurement, and mapmaking.*

Private, self-hosted mapping app. A multi-layer map **viewer** (GaiaGPS-style — stack
satellite / topo / outdoors / weather layers with per-layer opacity) plus a route
**planner** (RideWithGPS-style — snap-to-road walk/cycle/drive, elevation, surface
type, POIs, photos, GPX/KML/FIT import-export).

Free / open data sources only. Desktop web.

## Layout

```
web/   Vite + React + TS SPA (MapLibre GL JS)
api/   Fastify tile proxy (keeps keyed-source API keys off the client) + later: routes/POIs CRUD
```

## Develop

```bash
npm install            # installs all workspaces
cp .env.example .env   # fill in free-tier keys (optional — keyless layers work without)
npm run dev:api        # terminal 1 — tile proxy on :8787
npm run dev            # terminal 2 — web app on :5173
```

Keyless layers (OSM, Esri World Imagery, Sentinel-2, OpenTopoMap, RainViewer radar)
work with no `.env`. Thunderforest + OpenWeatherMap layers need their free keys.

## Status

Phase 1 — layer viewer. See the build plan for the full roadmap.

## Attribution

Map data © OpenStreetMap contributors. Imagery: Esri World Imagery, EOX Sentinel-2
cloudless (https://s2maps.eu). Topo: OpenTopoMap (CC-BY-SA), Thunderforest. Weather:
RainViewer, OpenWeatherMap. Attribution is shown in-app per active layer.
