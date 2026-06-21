export type Profile = 'bike' | 'foot' | 'car';

export interface SurfaceSpan {
  from: number;
  to: number;
  value: string;
}

/** Normalized route from /api/route (mirrors the api's NormalizedRoute). */
export interface RouteResult {
  engine: string;
  profile: Profile;
  distance: number; // metres
  duration: number; // seconds
  coordinates: [number, number][]; // [lng, lat]
  bbox: [number, number, number, number];
  elevationProfile: { dist: number; ele: number }[];
  ascent: number;
  descent: number;
  surfaces: SurfaceSpan[];
}

export type LngLat = [number, number];
