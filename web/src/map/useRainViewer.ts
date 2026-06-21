import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchRadarTimeline,
  frameTiles,
  formatFrameTime,
  type RadarTimeline,
} from './rainviewer';

const FRAME_MS = 600; // playback speed
const REFRESH_MS = 5 * 60 * 1000; // RainViewer updates ~every 5 min

export interface RainViewerState {
  tiles: string[]; // tiles for the current frame (empty until loaded)
  playing: boolean;
  index: number;
  frameCount: number;
  label: string;
  togglePlay: () => void;
  setIndex: (i: number) => void;
}

/** Manages the RainViewer radar timeline + animation, but only while `active`. */
export function useRainViewer(active: boolean): RainViewerState {
  const [timeline, setTimeline] = useState<RadarTimeline | null>(null);
  const [index, setIndexState] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<number | undefined>(undefined);

  // Fetch (and periodically refresh) the timeline while active.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const load = async () => {
      try {
        const tl = await fetchRadarTimeline();
        if (cancelled) return;
        setTimeline(tl);
        setIndexState(Math.max(0, tl.past.length - 1)); // start at "now"
      } catch {
        /* ignore */
      }
    };
    load();
    const refresh = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, [active]);

  // Animate.
  useEffect(() => {
    window.clearInterval(timer.current);
    if (!active || !playing || !timeline || timeline.frames.length === 0) return;
    timer.current = window.setInterval(() => {
      setIndexState((i) => (i + 1) % timeline.frames.length);
    }, FRAME_MS);
    return () => window.clearInterval(timer.current);
  }, [active, playing, timeline]);

  const setIndex = useCallback((i: number) => {
    setPlaying(false);
    setIndexState(i);
  }, []);

  const frames = timeline?.frames ?? [];
  const frame = frames[index];
  const tiles = timeline && frame ? frameTiles(timeline, frame) : [];

  return {
    tiles,
    playing,
    index,
    frameCount: frames.length,
    label: frame ? formatFrameTime(frame) : '',
    togglePlay: () => setPlaying((p) => !p),
    setIndex,
  };
}
