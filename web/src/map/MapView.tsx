import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CATALOG_BY_ID } from './layers';
import type { ActiveLayer } from './types';

const SRC_PREFIX = 'cg-src-';
const LYR_PREFIX = 'cg-lyr-';
const srcId = (defId: string) => SRC_PREFIX + defId;
const lyrId = (defId: string) => LYR_PREFIX + defId;

export interface MapViewProps {
  /** Active layers, top -> bottom (index 0 = topmost). */
  stack: ActiveLayer[];
  /** Runtime-resolved tiles for dynamic layers (e.g. current RainViewer frame). */
  dynamicTiles: Record<string, string[]>;
  /** Imperative fly-to target (e.g. from geocoder search). */
  flyTo?: { lng: number; lat: number; zoom?: number } | null;
}

const EMPTY_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    // Neutral backdrop so gaps (e.g. zoomed past a source's maxzoom) aren't black.
    { id: 'cg-bg', type: 'background', paint: { 'background-color': '#0b1622' } },
  ],
};

export function MapView({ stack, dynamicTiles, flyTo }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  // Track the tiles last applied to each dynamic source so we only setTiles on change.
  const appliedTiles = useRef<Record<string, string>>({});

  // Init map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: EMPTY_STYLE,
      center: [133.78, -25.27], // Australia, roughly centered
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
    map.on('load', () => {
      readyRef.current = true;
      reconcile();
    });
    mapRef.current = map;
    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconcile MapLibre layers with the desired stack.
  function reconcile() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    const bottomToTop = [...stack].reverse();
    const wanted = new Set(bottomToTop.map((a) => lyrId(a.defId)));

    // Remove layers/sources no longer in the stack.
    for (const layer of map.getStyle().layers ?? []) {
      if (layer.id.startsWith(LYR_PREFIX) && !wanted.has(layer.id)) {
        if (map.getLayer(layer.id)) map.removeLayer(layer.id);
        const defId = layer.id.slice(LYR_PREFIX.length);
        if (map.getSource(srcId(defId))) map.removeSource(srcId(defId));
        delete appliedTiles.current[defId];
      }
    }

    // Ensure + update each desired layer (bottom to top).
    for (const a of bottomToTop) {
      const def = CATALOG_BY_ID[a.defId];
      if (!def) continue;
      const tiles = def.dynamic ? dynamicTiles[def.id] : def.tiles;
      if (!tiles || tiles.length === 0) continue; // e.g. dynamic source not loaded yet

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
        // Dynamic source whose frame changed — swap tiles in place (no flicker).
        const sig = tiles.join('|');
        if (appliedTiles.current[def.id] !== sig) {
          const src = map.getSource(sId) as maplibregl.RasterTileSource;
          src.setTiles(tiles);
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

    // Enforce order: moving each (bottom -> top) to the top leaves topmost on top.
    for (const a of bottomToTop) {
      const lId = lyrId(a.defId);
      if (map.getLayer(lId)) map.moveLayer(lId);
    }
  }

  // Re-reconcile whenever the stack or dynamic tiles change.
  useEffect(() => {
    reconcile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack, dynamicTiles]);

  // Fly to a search result.
  useEffect(() => {
    if (flyTo && mapRef.current) {
      mapRef.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? 12 });
    }
  }, [flyTo]);

  return <div ref={containerRef} className="cg-map" />;
}
