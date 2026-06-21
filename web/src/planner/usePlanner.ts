import { useCallback, useEffect, useRef, useState } from 'react';
import type { LngLat, Profile, RouteResult } from './types';

function haversine(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Straight-line "route" through the waypoints (off-road draw mode — no snapping). */
function straightRoute(points: LngLat[], profile: Profile): RouteResult {
  let distance = 0;
  for (let i = 1; i < points.length; i++) distance += haversine(points[i - 1], points[i]);
  return {
    engine: 'straight',
    profile,
    distance,
    duration: 0,
    coordinates: points.map((p) => [p[0], p[1]] as LngLat),
    bbox: [0, 0, 0, 0],
    elevationProfile: [],
    ascent: 0,
    descent: 0,
    surfaces: [],
  };
}

export interface PlannerState {
  profile: Profile;
  waypoints: LngLat[];
  route: RouteResult | null;
  loading: boolean;
  error: string | null;
  drawStraight: boolean;
  hoverDist: number | null;
  setProfile: (p: Profile) => void;
  setDrawStraight: (v: boolean) => void;
  addPoint: (p: LngLat) => void;
  movePoint: (i: number, p: LngLat) => void;
  undo: () => void;
  clear: () => void;
  setHoverDist: (d: number | null) => void;
}

export function usePlanner(): PlannerState {
  const [profile, setProfile] = useState<Profile>('bike');
  const [waypoints, setWaypoints] = useState<LngLat[]>([]);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawStraight, setDrawStraight] = useState(false);
  const [hoverDist, setHoverDist] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounce = useRef<number | undefined>(undefined);

  // Recompute the route whenever the waypoints, profile, or mode change.
  useEffect(() => {
    window.clearTimeout(debounce.current);
    if (waypoints.length < 2) {
      setRoute(null);
      setError(null);
      return;
    }
    if (drawStraight) {
      setRoute(straightRoute(waypoints, profile));
      setError(null);
      return;
    }
    debounce.current = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/route', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ profile, points: waypoints, elevation: true }),
          signal: ac.signal,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `route ${res.status}`);
        }
        setRoute((await res.json()) as RouteResult);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message);
          setRoute(null);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(debounce.current);
  }, [waypoints, profile, drawStraight]);

  const addPoint = useCallback((p: LngLat) => setWaypoints((w) => [...w, p]), []);
  const movePoint = useCallback(
    (i: number, p: LngLat) => setWaypoints((w) => w.map((x, idx) => (idx === i ? p : x))),
    [],
  );
  const undo = useCallback(() => setWaypoints((w) => w.slice(0, -1)), []);
  const clear = useCallback(() => setWaypoints([]), []);

  return {
    profile,
    waypoints,
    route,
    loading,
    error,
    drawStraight,
    hoverDist,
    setProfile,
    setDrawStraight,
    addPoint,
    movePoint,
    undo,
    clear,
    setHoverDist,
  };
}
