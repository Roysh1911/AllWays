// Pure helpers for the route map, so they run in unit tests.
import { distanceM, type LatLng } from './geo.ts';

export type TrailPoint = LatLng & { ts: string };

/** A jump longer than this between two consecutive points is drawn dashed (flight, night bus). */
export const JUMP_M = 50_000;

export type Segment = { points: LatLng[]; jump: boolean };

/**
 * Split a time-ordered trail into solid runs and dashed jumps.
 * Each jump is its own two-point segment, so the line stays continuous.
 */
export function segments(points: LatLng[], jumpM = JUMP_M): Segment[] {
  const out: Segment[] = [];
  let run: LatLng[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];
    if (prev && distanceM(prev, p) > jumpM) {
      if (run.length > 1) out.push({ points: run, jump: false });
      out.push({ points: [prev, p], jump: true });
      run = [p];
    } else {
      run.push(p);
    }
  }
  if (run.length > 1) out.push({ points: run, jump: false });
  return out;
}

/** Keep at most `max` points, evenly spaced, always keeping the first and last. */
export function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max || max < 2) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

export type Range = 'day' | 'week' | 'all';

export const RANGES: { key: Range; label: string; ms: number | null }[] = [
  { key: 'day', label: 'יום', ms: 24 * 3600 * 1000 },
  { key: 'week', label: 'שבוע', ms: 7 * 24 * 3600 * 1000 },
  { key: 'all', label: 'הכול', ms: null },
];

/** ISO timestamp the query should start from, or null for everything. */
export function rangeStart(range: Range, now: number = Date.now()): string | null {
  const ms = RANGES.find((r) => r.key === range)?.ms ?? null;
  return ms === null ? null : new Date(now - ms).toISOString();
}
