import type { ActiveLayer } from './types';

// Saved layer combinations. Built-in presets ship with the app; user presets are
// persisted to localStorage (Phase 1 — moves to the DB once the backend lands).

export interface Preset {
  id: string;
  name: string;
  stack: ActiveLayer[];
  builtin?: boolean;
}

const layer = (defId: string, opacity = 1, visible = true): ActiveLayer => ({
  defId,
  opacity,
  visible,
});

export const BUILTIN_PRESETS: Preset[] = [
  {
    id: 'builtin-satellite',
    name: 'Satellite',
    builtin: true,
    stack: [layer('esri-imagery')],
  },
  {
    id: 'builtin-topo-radar',
    name: 'Topo + Radar',
    builtin: true,
    stack: [layer('rainviewer-radar', 0.75), layer('opentopomap')],
  },
  {
    id: 'builtin-sat-topo',
    name: 'Satellite + Topo 50%',
    builtin: true,
    stack: [layer('opentopomap', 0.5), layer('esri-imagery')],
  },
];

const LS_KEY = 'seshat.presets';

export function loadUserPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Preset[];
  } catch {
    return [];
  }
}

export function saveUserPresets(presets: Preset[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(presets));
}

export function makePresetId(): string {
  return 'user-' + Math.random().toString(36).slice(2, 10);
}
