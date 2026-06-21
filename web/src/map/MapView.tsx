import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CATALOG_BY_ID } from './layers';
import type { ActiveLayer } from './types';
import type { LngLat, RouteResult } from '../planner/types';

const SRC_PREFIX = 'cg-src-';
const LYR_PREFIX = 'cg-lyr-';
const srcId = (defId: string) => SRC_PREFIX + defId;
const lyrId = (defId: string) => LYR_PREFIX + defId;

const ROUTE_SRC = 'cg-route';
const ROUTE_CASING = 'cg-route-casing';
const ROUTE_LINE = 'cg-route-line';

export interface MapViewProps {
  /** Active layers, top -> bottom (index 0 = topmost). */
  stack: ActiveLayer[];
  /** Runtime-resolved tiles for dynamic layers (e.g. current RainViewer frame). */
  dynamicTiles: Record<string, string[]>;
  /** Imperative fly-to target (e.g. from geocoder search). */
  flyTo?: { lng: number; lat: number; zoom?: number } | null;
  // ---- planner ----
  planning: boolean;
  waypoints: LngLat[];
  route: RouteResult | null;
  /** Point along the route to highlight (from elevation-chart hover). */
  hoverPoint: LngLat | null;
  onMapClick: (p: LngLat) => void;
  onWaypointDragEnd: (i: number, p: LngLat) => void;
}

const EMPTY_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    // Neutral backdrop so gaps (e.g. zoomed past a source's maxzoom) aren't black.
    { id: 'cg-bg', type: 'background', paint: { 'background-color': '#0b1622' } },
  ],
};

// Surface -> colour. paved family green, gravel family amber, dirt/loose brown.
function surfaceColor(value: string): string {
  const v = value.toLowerCase();
  if (/(asphalt|paved|concrete|paving|metal|wood)/.test(v)) return '#2bb673';
  if (/(gravel|compacted|fine_gravel|pebble|unpaved)/.test(v)) return '#e0922f';
  if (/(dirt|ground|earth|mud|sand|grass|unhewn|rock)/.test(v)) return '#b5651d';
  return '#e8338a'; // unknown / default route colour
}

function routeFeatures(route: RouteResult | null): GeoJSON.FeatureCollection {
  if (!route || route.coordinates.length < 2) {
    return { type: 'FeatureCollection', features: [] };
  }
  const coords = route.coordinates;
  const features: GeoJSON.Feature[] = [];
  if (route.surfaces.length > 0) {
    for (const span of route.surfaces) {
      const seg = coords.slice(span.from, span.to + 1);
      if (seg.length < 2) continue;
      features.push({
        type: 'Feature',
        properties: { color: surfaceColor(span.value), surface: span.value },
        geometry: { type: 'LineString', coordinates: seg },
      });
    }
  } else {
    features.push({
      type: 'Feature',
      properties: { color: '#e8338a', surface: '' },
      geometry: { type: 'LineString', coordinates: coords },
    });
  }
  return { type: 'FeatureCollection', features };
}

function markerEl(label: string, kind: 'start' | 'mid' | 'end'): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `cg-wp cg-wp-${kind}`;
  el.textContent = label;
  return el;
}

export function MapView({
  stack,
  dynamicTiles,
  flyTo,
  planning,
  waypoints,
  route,
  hoverPoint,
  onMapClick,
  onWaypointDragEnd,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const appliedTiles = useRef<Record<string, string>>({});
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const hoverMarkerRef = useRef<maplibregl.Marker | null>(null);
  // Keep latest callbacks/state for stable map event handlers.
  const cb = useRef({ planning, onMapClick, onWaypointDragEnd });
  cb.current = { planning, onMapClick, onWaypointDragEnd };

  // Init map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: EMPTY_STYLE,
      center: [133.78, -25.27],
      zoom: 3.5,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'top-left',
    );
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('click', (e) => {
      if (cb.current.planning) onMapClickRef(e);
    });
    function onMapClickRef(e: maplibregl.MapMouseEvent) {
      cb.current.onMapClick([e.lngLat.lng, e.lngLat.lat]);
    }

    map.on('load', () => {
      readyRef.current = true;
      map.addSource(ROUTE_SRC, { type: 'geojson', data: routeFeatures(null) });
      map.addLayer({
        id: ROUTE_CASING,
        type: 'line',
        source: ROUTE_SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 },
      });
      map.addLayer({
        id: ROUTE_LINE,
        type: 'line',
        source: ROUTE_SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 4 },
      });
      reconcile();
      reconcileRoute();
    });
    mapRef.current = map;
    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function moveOverlaysTop() {
    const map = mapRef.current;
    if (!map) return;
    for (const id of [ROUTE_CASING, ROUTE_LINE]) if (map.getLayer(id)) map.moveLayer(id);
  }

  // Reconcile raster layers with the desired stack.
  function reconcile() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    const bottomToTop = [...stack].reverse();
    const wanted = new Set(bottomToTop.map((a) => lyrId(a.defId)));

    for (const layer of map.getStyle().layers ?? []) {
      if (layer.id.startsWith(LYR_PREFIX) && !wanted.has(layer.id)) {
        if (map.getLayer(layer.id)) map.removeLayer(layer.id);
        const defId = layer.id.slice(LYR_PREFIX.length);
        if (map.getSource(srcId(defId))) map.removeSource(srcId(defId));
        delete appliedTiles.current[defId];
      }
    }

    for (const a of bottomToTop) {
      const def = CATALOG_BY_ID[a.defId];
      if (!def) continue;
      const tiles = def.dynamic ? dynamicTiles[def.id] : def.tiles;
      if (!tiles || tiles.length === 0) continue;

      const sId = srcId(def.id);
      const lId = lyrId(def.id);

      if (!map.getSource(sId)) {
        map.addSource(sId, {
          type: 'raster',
          tiles,
          tileSize: def.tileSize ?? 256,
          minzoom: def.minzoom ?? 0,
          maxzoom: def.maxzoom ?? 22,
          attribution: def.attribution,
        });
        appliedTiles.current[def.id] = tiles.join('|');
      } else {
        const sig = tiles.join('|');
        if (appliedTiles.current[def.id] !== sig) {
          (map.getSource(sId) as maplibregl.RasterTileSource).setTiles(tiles);
          appliedTiles.current[def.id] = sig;
        }
      }

      if (!map.getLayer(lId)) {
        map.addLayer({
          id: lId,
          type: 'raster',
          source: sId,
          paint: { 'raster-opacity': a.opacity },
          layout: { visibility: a.visible ? 'visible' : 'none' },
        });
      } else {
        map.setPaintProperty(lId, 'raster-opacity', a.opacity);
        map.setLayoutProperty(lId, 'visibility', a.visible ? 'visible' : 'none');
      }
    }

    for (const a of bottomToTop) {
      const lId = lyrId(a.defId);
      if (map.getLayer(lId)) map.moveLayer(lId);
    }
    moveOverlaysTop(); // keep the route above all rasters
  }

  // Reconcile the route line + waypoint markers.
  function reconcileRoute() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource(ROUTE_SRC) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(routeFeatures(route));
    moveOverlaysTop();

    // Markers: rebuild to match waypoints (small N).
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    if (planning) {
      waypoints.forEach((wp, i) => {
        const kind = i === 0 ? 'start' : i === waypoints.length - 1 ? 'end' : 'mid';
        const label = i === 0 ? 'A' : i === waypoints.length - 1 ? 'B' : String(i);
        const marker = new maplibregl.Marker({ element: markerEl(label, kind), draggable: true })
          .setLngLat(wp)
          .addTo(map);
        marker.on('dragend', () => {
          const { lng, lat } = marker.getLngLat();
          cb.current.onWaypointDragEnd(i, [lng, lat]);
        });
        markersRef.current.push(marker);
      });
    }
  }

  // Hover marker (elevation chart -> map).
  function reconcileHover() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (hoverPoint) {
      if (!hoverMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'cg-hover-dot';
        hoverMarkerRef.current = new maplibregl.Marker({ element: el });
      }
      hoverMarkerRef.current.setLngLat(hoverPoint).addTo(map);
    } else {
      hoverMarkerRef.current?.remove();
    }
  }

  useEffect(() => {
    reconcile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack, dynamicTiles]);

  useEffect(() => {
    reconcileRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, waypoints, planning]);

  useEffect(() => {
    reconcileHover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverPoint]);

  // Crosshair cursor while planning.
  useEffect(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = planning ? 'crosshair' : '';
  }, [planning]);

  useEffect(() => {
    if (flyTo && mapRef.current) {
      mapRef.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? 12 });
    }
  }, [flyTo]);

  return <div ref={containerRef} className="cg-map" />;
}
