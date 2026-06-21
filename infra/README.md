# Infra

## Routing — hybrid GraphHopper (SE Queensland) + OSRM worldwide

Routing picks the engine per request (see `api/src/routing.ts`):

- every waypoint inside `GRAPHHOPPER_BBOX` → **self-hosted GraphHopper** (native
  elevation + surface colouring)
- anything outside, or a route crossing the boundary → **public OSRM** (keyless)
- GraphHopper unreachable / can't route → automatic OSRM fallback

The deployed stack (`docker-compose.yml`) self-hosts GraphHopper for **SE Queensland**
only — the homelab is RAM-tight, and a regional graph builds + serves in ~1.5–2.5 GB
where a full-Australia build needs 4–6 GB. The rest of the world routes via OSRM.

### How GraphHopper is built (automatic)

Two services handle it, no manual download needed:

1. **`gh-prep`** (one-shot) — downloads the `australia-oceania` extract from Geofabrik
   and crops it to `GRAPHHOPPER_BBOX` with `osmium extract`, into the `gh-data` volume.
   Idempotent: skips if the cropped `region.osm.pbf` already exists, so redeploys don't
   re-download the ~1.4 GB file. The source is deleted after cropping to save disk.
2. **`graphhopper`** (`israelhikingmap/graphhopper` — there is no official image) —
   waits for `gh-prep`, imports `region.osm.pbf`, and serves on `:8989`. SRTM elevation
   tiles + the built graph are cached in `gh-data` so restarts are fast. Heap is capped
   via `JAVA_OPTS` (`-Xmx2200m`) to fit the VM.

### Changing the region

Set `GRAPHHOPPER_BBOX` (env, `left,bottom,right,top`). It is used **both** to crop the
extract and to tell the api where GraphHopper is authoritative — keep them identical.
Default SE-QLD: `151.5,-28.5,153.6,-26.3` (Brisbane, Gold Coast, Sunshine Coast,
Toowoomba/Ipswich hinterland). To widen, raise the heap and check the VM has the RAM.

> **Full Australia** needs ~4–6 GB during import — more than the current homelab hosts
> have free. Add physical RAM (or run GraphHopper on a bigger box and point
> `GRAPHHOPPER_URL` at it) before widening the bbox to the whole country. For true
> planet self-hosting on modest RAM, swap GraphHopper for Valhalla (tile-based) — a
> contained change to the `graphhopper` service + the `routeGraphHopper` adapter.

## Coolify

Deployed as a **Docker Compose** application on the `homelab` project, server `localhost`.
`web` binds host port **8091** (no domain) — reach it at `http://192.168.3.51:8091`.
`api`/`graphhopper`/`gh-prep` are internal to the compose network. Tile API keys
(`THUNDERFOREST_API_KEY`, `OPENWEATHERMAP_API_KEY`) are set as Coolify env vars and
stay server-side. The `gh-data` volume persists the OSM region + built graph across
redeploys.
