import { useEffect, useMemo, useState } from 'react';
import { MapView } from './map/MapView';
import { LayerManager, type Availability } from './map/LayerManager';
import { Geocoder } from './search/Geocoder';
import { CATALOG_BY_ID } from './map/layers';
import type { ActiveLayer } from './map/types';
import { useRainViewer } from './map/useRainViewer';
import {
  BUILTIN_PRESETS,
  loadUserPresets,
  saveUserPresets,
  makePresetId,
  type Preset,
} from './map/presets';

const DEFAULT_STACK: ActiveLayer[] = [{ defId: 'opentopomap', opacity: 1, visible: true }];

export default function App() {
  const [stack, setStack] = useState<ActiveLayer[]>(DEFAULT_STACK);
  const [userPresets, setUserPresets] = useState<Preset[]>(() => loadUserPresets());
  const [availability, setAvailability] = useState<Availability>({
    thunderforest: false,
    openweathermap: false,
  });
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  // Ask the api which keyed sources are configured.
  useEffect(() => {
    fetch('/api/keys')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAvailability(d))
      .catch(() => {
        /* api not running — keyed layers stay disabled */
      });
  }, []);

  const radarActive = stack.some((s) => s.defId === 'rainviewer-radar' && s.visible);
  const rv = useRainViewer(radarActive);

  const dynamicTiles = useMemo<Record<string, string[]>>(() => {
    const d: Record<string, string[]> = {};
    if (rv.tiles.length) d['rainviewer-radar'] = rv.tiles;
    return d;
  }, [rv.tiles]);

  // --- stack mutations ---
  const addLayer = (defId: string) =>
    setStack((s) => {
      if (s.some((x) => x.defId === defId)) return s;
      const def = CATALOG_BY_ID[defId];
      const next: ActiveLayer = { defId, opacity: def?.defaultOpacity ?? 1, visible: true };
      return [next, ...s]; // new layers go on top
    });
  const removeLayer = (defId: string) => setStack((s) => s.filter((x) => x.defId !== defId));
  const toggleLayer = (defId: string) =>
    setStack((s) => s.map((x) => (x.defId === defId ? { ...x, visible: !x.visible } : x)));
  const setOpacity = (defId: string, opacity: number) =>
    setStack((s) => s.map((x) => (x.defId === defId ? { ...x, opacity } : x)));
  const reorder = (from: number, to: number) =>
    setStack((s) => {
      const next = [...s];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  // --- presets ---
  const presets = [...BUILTIN_PRESETS, ...userPresets];
  const applyPreset = (p: Preset) => setStack(p.stack.map((l) => ({ ...l })));
  const savePreset = (name: string) => {
    const p: Preset = { id: makePresetId(), name, stack: stack.map((l) => ({ ...l })) };
    const next = [...userPresets, p];
    setUserPresets(next);
    saveUserPresets(next);
  };
  const deletePreset = (id: string) => {
    const next = userPresets.filter((p) => p.id !== id);
    setUserPresets(next);
    saveUserPresets(next);
  };

  return (
    <div className="cg-app">
      <MapView stack={stack} dynamicTiles={dynamicTiles} flyTo={flyTo} />

      <div className="cg-topbar">
        <button
          className="cg-panel-toggle"
          onClick={() => setPanelOpen((o) => !o)}
          title="Toggle layers panel"
        >
          ☰
        </button>
        <Geocoder onSelect={(r) => setFlyTo({ lng: r.lng, lat: r.lat })} />
      </div>

      {panelOpen && (
        <LayerManager
          stack={stack}
          availability={availability}
          rv={rv}
          presets={presets}
          onAdd={addLayer}
          onRemove={removeLayer}
          onToggle={toggleLayer}
          onOpacity={setOpacity}
          onReorder={reorder}
          onApplyPreset={applyPreset}
          onSavePreset={savePreset}
          onDeletePreset={deletePreset}
        />
      )}
    </div>
  );
}
