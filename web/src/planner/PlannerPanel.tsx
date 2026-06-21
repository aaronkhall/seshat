import type { PlannerState } from './usePlanner';
import type { Profile } from './types';
import { formatDistance, formatDuration } from './geo';

const PROFILES: { id: Profile; label: string; icon: string }[] = [
  { id: 'bike', label: 'Cycle', icon: '🚲' },
  { id: 'foot', label: 'Walk', icon: '🥾' },
  { id: 'car', label: 'Drive', icon: '🚗' },
];

export interface PlannerPanelProps {
  planner: PlannerState;
  routingEngine: string;
}

export function PlannerPanel({ planner, routingEngine }: PlannerPanelProps) {
  const { route, waypoints } = planner;
  return (
    <div className="cg-planner">
      <div className="cg-planner-head">
        <span className="cg-logo">▲ Route planner</span>
      </div>

      <div className="cg-profile-row">
        {PROFILES.map((p) => (
          <button
            key={p.id}
            className={planner.profile === p.id ? 'active' : ''}
            onClick={() => planner.setProfile(p.id)}
            disabled={planner.drawStraight}
            title={planner.drawStraight ? 'Disabled in draw-line mode' : p.label}
          >
            <span>{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      <label className="cg-toggle">
        <input
          type="checkbox"
          checked={planner.drawStraight}
          onChange={(e) => planner.setDrawStraight(e.target.checked)}
        />
        Draw straight lines (off-road, no snapping)
      </label>

      <div className="cg-planner-actions">
        <button onClick={planner.undo} disabled={!waypoints.length}>
          ↶ Undo point
        </button>
        <button onClick={planner.clear} disabled={!waypoints.length}>
          Clear
        </button>
      </div>

      {planner.loading && <p className="cg-planner-note">Routing…</p>}
      {planner.error && <p className="cg-planner-error">Routing failed: {planner.error}</p>}

      {route ? (
        <div className="cg-route-stats">
          <div className="cg-stat">
            <span className="cg-stat-val">{formatDistance(route.distance)}</span>
            <span className="cg-stat-lbl">distance</span>
          </div>
          <div className="cg-stat">
            <span className="cg-stat-val">{formatDuration(route.duration)}</span>
            <span className="cg-stat-lbl">moving time</span>
          </div>
          <div className="cg-stat">
            <span className="cg-stat-val">↗ {route.ascent} m</span>
            <span className="cg-stat-lbl">↘ {route.descent} m</span>
          </div>
        </div>
      ) : (
        <p className="cg-planner-note">
          Click the map to drop points{waypoints.length === 1 ? ' — one more to route' : ''}.
        </p>
      )}

      {route && route.surfaces.length > 0 && (
        <div className="cg-surface-legend">
          <span className="cg-sw" style={{ background: '#2bb673' }} /> paved
          <span className="cg-sw" style={{ background: '#e0922f' }} /> gravel
          <span className="cg-sw" style={{ background: '#b5651d' }} /> dirt
        </div>
      )}

      <p className="cg-engine-note">
        engine: {routingEngine}
        {routingEngine !== 'graphhopper' && ' · surface colouring needs self-hosted GraphHopper'}
      </p>
    </div>
  );
}
