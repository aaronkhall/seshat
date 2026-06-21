import { useState } from 'react';
import { CATALOG_BY_ID, catalogByCategory, type LayerDef } from './layers';
import type { ActiveLayer } from './types';
import type { Preset } from './presets';
import type { RainViewerState } from './useRainViewer';

export interface Availability {
  thunderforest: boolean;
  openweathermap: boolean;
}

export interface LayerManagerProps {
  stack: ActiveLayer[];
  availability: Availability;
  rv: RainViewerState;
  presets: Preset[];
  onAdd: (defId: string) => void;
  onRemove: (defId: string) => void;
  onToggle: (defId: string) => void;
  onOpacity: (defId: string, value: number) => void;
  onReorder: (from: number, to: number) => void;
  onApplyPreset: (p: Preset) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
}

function keyAvailable(def: LayerDef, a: Availability): boolean {
  if (def.requiresKey === 'thunderforest') return a.thunderforest;
  if (def.requiresKey === 'openweathermap') return a.openweathermap;
  return true;
}

export function LayerManager(props: LayerManagerProps) {
  const { stack, availability, rv, presets } = props;
  const [tab, setTab] = useState<'active' | 'add'>('active');
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const radarActive = stack.some((s) => s.defId === 'rainviewer-radar' && s.visible);

  return (
    <div className="cg-panel">
      <div className="cg-panel-header">
        <span className="cg-logo">▲ Seshat</span>
      </div>

      <div className="cg-tabs">
        <button className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>
          Layers {stack.length > 0 && <span className="cg-badge">{stack.length}</span>}
        </button>
        <button className={tab === 'add' ? 'active' : ''} onClick={() => setTab('add')}>
          Add layer
        </button>
      </div>

      {tab === 'active' && (
        <div className="cg-panel-body">
          <PresetBar
            presets={presets}
            onApply={props.onApplyPreset}
            onSave={props.onSavePreset}
            onDelete={props.onDeletePreset}
            canSave={stack.length > 0}
          />

          {stack.length === 0 && (
            <p className="cg-empty">No layers yet. Switch to “Add layer” to stack maps.</p>
          )}

          <ul className="cg-active-list">
            {stack.map((a, i) => {
              const def = CATALOG_BY_ID[a.defId];
              if (!def) return null;
              return (
                <li
                  key={a.defId}
                  className={`cg-active-item${dragIdx === i ? ' dragging' : ''}`}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx !== null && dragIdx !== i) props.onReorder(dragIdx, i);
                    setDragIdx(null);
                  }}
                  onDragEnd={() => setDragIdx(null)}
                >
                  <div className="cg-active-row">
                    <span className="cg-drag" title="Drag to reorder">⠿</span>
                    <input
                      type="checkbox"
                      checked={a.visible}
                      onChange={() => props.onToggle(a.defId)}
                      title="Show / hide"
                    />
                    <span className="cg-active-name">{def.name}</span>
                    <button
                      className="cg-remove"
                      onClick={() => props.onRemove(a.defId)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="cg-opacity-row">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(a.opacity * 100)}
                      onChange={(e) => props.onOpacity(a.defId, Number(e.target.value) / 100)}
                    />
                    <span className="cg-opacity-val">{Math.round(a.opacity * 100)}%</span>
                  </div>
                </li>
              );
            })}
          </ul>

          {radarActive && <RadarTimeline rv={rv} />}
        </div>
      )}

      {tab === 'add' && (
        <div className="cg-panel-body">
          {catalogByCategory().map((g) => (
            <div key={g.category} className="cg-cat">
              <h4>{g.category}</h4>
              {g.layers.map((def) => {
                const inStack = stack.some((s) => s.defId === def.id);
                const avail = keyAvailable(def, availability);
                return (
                  <button
                    key={def.id}
                    className={`cg-add-item${inStack ? ' in-stack' : ''}`}
                    disabled={!avail || inStack}
                    onClick={() => props.onAdd(def.id)}
                    title={!avail ? 'Add the API key in .env to enable' : def.note ?? ''}
                  >
                    <span className="cg-add-name">
                      {def.name}
                      <span className="cg-kind">{def.kind}</span>
                    </span>
                    <span className="cg-add-note">
                      {inStack ? 'added' : !avail ? 'key needed' : def.note ?? ''}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PresetBar({
  presets,
  onApply,
  onSave,
  onDelete,
  canSave,
}: {
  presets: Preset[];
  onApply: (p: Preset) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  canSave: boolean;
}) {
  return (
    <div className="cg-presets">
      <div className="cg-presets-row">
        {presets.map((p) => (
          <span key={p.id} className="cg-preset-chip">
            <button onClick={() => onApply(p)}>{p.name}</button>
            {!p.builtin && (
              <button className="cg-preset-del" title="Delete preset" onClick={() => onDelete(p.id)}>
                ✕
              </button>
            )}
          </span>
        ))}
      </div>
      <button
        className="cg-save-preset"
        disabled={!canSave}
        onClick={() => {
          const name = window.prompt('Save current layers as preset — name:');
          if (name) onSave(name.trim());
        }}
      >
        + Save current as preset
      </button>
    </div>
  );
}

function RadarTimeline({ rv }: { rv: RainViewerState }) {
  if (rv.frameCount === 0) return <p className="cg-empty">Loading radar…</p>;
  return (
    <div className="cg-radar">
      <div className="cg-radar-head">
        <button onClick={rv.togglePlay}>{rv.playing ? '❚❚' : '▶'}</button>
        <span className="cg-radar-label">Radar · {rv.label}</span>
      </div>
      <input
        type="range"
        min={0}
        max={rv.frameCount - 1}
        value={rv.index}
        onChange={(e) => rv.setIndex(Number(e.target.value))}
      />
    </div>
  );
}
