# Infra

## Routing engine (GraphHopper) — optional, for production-quality routing

By default the api uses the **keyless public OSRM** servers (FOSSGIS) — fine for
development and light use, but no native elevation/surface and subject to fair-use
limits. For the real experience (native elevation + **surface colouring**, custom
"prefer paved / avoid hills" models), self-host GraphHopper.

### Hybrid routing (GraphHopper in your region, OSRM worldwide)

You don't need a planet build. Set `GRAPHHOPPER_URL` and import just the region(s)
you ride. Routing then picks the engine **per request**:

- every waypoint inside `GRAPHHOPPER_BBOX` → **GraphHopper** (elevation + surface)
- any point outside, or a route crossing the boundary → **public OSRM**
- GraphHopper unreachable/can't route → automatic OSRM fallback

`GRAPHHOPPER_BBOX` defaults to Australia (`112,-44,154,-9`). Set it to match your
extract. `GET /api/config` reports `{"routingEngine":"hybrid", "selfHostedBbox":[...]}`,
and each route response carries the `engine` that actually produced it.

### 1. Get an OSM extract

Download the region(s) you ride from [Geofabrik](https://download.geofabrik.de/)
and save as `infra/graphhopper/data/region.osm.pbf`:

```bash
mkdir -p infra/graphhopper/data
# Example — Australia (~1.5 GB). Pick your region; smaller = faster build, less RAM.
curl -L https://download.geofabrik.de/australia-oceania/australia-latest.osm.pbf \
  -o infra/graphhopper/data/region.osm.pbf
```

> **Global note:** a planet build needs ~32–64 GB RAM. Self-host the continents you
> actually use; the api falls back to public OSRM outside the self-hosted region.
> For true planet self-hosting on modest hardware, swap GraphHopper for Valhalla
> (tile-based, low RAM) — it's a contained change to the `routing` service + the
> `routeGraphHopper` adapter in `api/src/routing.ts`.

### 2. Build the graph + run

```bash
docker compose --profile routing up graphhopper   # first run imports the pbf (minutes)
```

The graph cache lands in `infra/graphhopper/data/graph-cache` (gitignored). Later
runs start fast.

### 3. Point the api at it

```bash
# .env (repo root)
GRAPHHOPPER_URL=http://graphhopper:8989   # in docker compose
# or http://localhost:8989 when running the api on the host
```

Restart the api. `GET /api/config` should now report `{"routingEngine":"graphhopper"}`
and routes will include elevation + surface spans.

## Coolify

Deploy the compose stack. The `web` (nginx) service proxies `/api` to `api`, so tile
keys stay server-side and there's no CORS. Add the `routing` profile + a persistent
volume for `infra/graphhopper/data` if you self-host GraphHopper there.
