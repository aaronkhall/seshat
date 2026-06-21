import { useMemo, useRef } from 'react';
import type { RouteResult } from './types';
import { formatDistance } from './geo';

const VB_W = 1000;
const VB_H = 160;
const PAD = { top: 12, right: 8, bottom: 18, left: 38 };

export interface ElevationChartProps {
  route: RouteResult;
  hoverDist: number | null;
  onHover: (dist: number | null) => void;
}

export function ElevationChart({ route, hoverDist, onHover }: ElevationChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const prof = route.elevationProfile;

  const geom = useMemo(() => {
    if (prof.length < 2) return null;
    const maxDist = prof[prof.length - 1].dist || 1;
    const eles = prof.map((p) => p.ele);
    const minE = Math.min(...eles);
    const maxE = Math.max(...eles);
    const range = Math.max(1, maxE - minE);
    const x = (d: number) => PAD.left + (d / maxDist) * (VB_W - PAD.left - PAD.right);
    const y = (e: number) => PAD.top + (1 - (e - minE) / range) * (VB_H - PAD.top - PAD.bottom);
    const line = prof.map((p) => `${x(p.dist)},${y(p.ele)}`).join(' ');
    const area = `${x(0)},${VB_H - PAD.bottom} ${line} ${x(maxDist)},${VB_H - PAD.bottom}`;
    return { maxDist, minE, maxE, x, y, line, area };
  }, [prof]);

  if (!geom) {
    return (
      <div className="cg-elev">
        <span className="cg-elev-empty">
          {route.engine === 'straight'
            ? 'No elevation for straight-line segments.'
            : 'No elevation data for this route.'}
        </span>
      </div>
    );
  }

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !geom) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * VB_W;
    const frac = (px - PAD.left) / (VB_W - PAD.left - PAD.right);
    onHover(Math.max(0, Math.min(1, frac)) * geom.maxDist);
  }

  const hoverX = hoverDist != null ? geom.x(hoverDist) : null;
  const hoverEle =
    hoverDist != null
      ? prof.reduce((best, p) =>
          Math.abs(p.dist - hoverDist) < Math.abs(best.dist - hoverDist) ? p : best,
        ).ele
      : null;

  return (
    <div className="cg-elev">
      <div className="cg-elev-stats">
        <span>↗ {route.ascent} m</span>
        <span>↘ {route.descent} m</span>
        {hoverEle != null && (
          <span className="cg-elev-hover">
            {formatDistance(hoverDist!)} · {Math.round(hoverEle)} m
          </span>
        )}
      </div>
      <svg
        ref={svgRef}
        className="cg-elev-svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => onHover(null)}
      >
        <polygon points={geom.area} fill="rgba(43,182,115,0.18)" />
        <polyline points={geom.line} fill="none" stroke="#2bb673" strokeWidth={2} />
        <text x={4} y={geom.y(geom.maxE) + 4} className="cg-elev-axis">
          {Math.round(geom.maxE)}
        </text>
        <text x={4} y={geom.y(geom.minE)} className="cg-elev-axis">
          {Math.round(geom.minE)}
        </text>
        {hoverX != null && (
          <line x1={hoverX} y1={PAD.top} x2={hoverX} y2={VB_H - PAD.bottom} stroke="#e8338a" strokeWidth={1} />
        )}
      </svg>
    </div>
  );
}
