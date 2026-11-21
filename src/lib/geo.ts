// Pure geometry helpers. No React Native imports, so they run in unit tests.

export type LatLng = { lat: number; lng: number };

const R = 6371008.8; // mean Earth radius, metres
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Normalise any angle to [0, 360). */
export function norm360(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/** Normalise any angle to (-180, 180]. */
export function norm180(deg: number): number {
  const d = norm360(deg);
  return d > 180 ? d - 360 : d;
}

/** Great-circle distance in metres (haversine). */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial great-circle bearing from a to b, degrees clockwise from true north. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return norm360(toDeg(Math.atan2(y, x)));
}

/** Rotation for the needle on screen: where the partner is, relative to where the phone points. */
export function needleRotation(bearing: number, heading: number): number {
  return norm360(bearing - heading);
}

/**
 * Move `current` toward `target` by `factor` along the shortest arc.
 * Keeps the needle from spinning the long way round when crossing 0°/360°.
 * Returns an unbounded angle so animations stay continuous.
 */
export function approachAngle(current: number, target: number, factor: number): number {
  const diff = norm180(target - current);
  return current + diff * factor;
}

/** Round coordinates to ~1 km before sending them to third parties. */
export function coarse(p: LatLng, decimals = 2): LatLng {
  const f = 10 ** decimals;
  return { lat: Math.round(p.lat * f) / f, lng: Math.round(p.lng * f) / f };
}

/** Should a new point be stored, given the last stored one? */
export function shouldStore(
  last: (LatLng & { ts: number }) | null,
  next: LatLng & { ts: number },
  minDistanceM: number,
  minIntervalMs: number,
): boolean {
  if (!last) return true;
  if (next.ts - last.ts >= minIntervalMs) return true;
  return distanceM(last, next) >= minDistanceM;
}

/** Human distance in Hebrew. */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} מ'`;
  const km = m / 1000;
  return km < 10 ? `${km.toFixed(1)} ק"מ` : `${Math.round(km).toLocaleString('he-IL')} ק"מ`;
}

/** Assumed accuracy when a fix doesn't report one (metres). */
export const UNKNOWN_ACC_M = 65;
/** Never call anything closer than this "far", whatever the reported accuracy. */
export const NEARBY_FLOOR_M = 30;
/** Above this combined uncertainty, "right next to you" would be a lie; show the needle instead. */
export const NEARBY_MAX_M = 300;

/**
 * Are we so close that the direction is meaningless?
 * True when the distance is inside the two fixes' combined uncertainty —
 * the error circles overlap, so the needle could point anywhere.
 */
export function isNearby(distance: number, myAcc: number | null, partnerAcc: number | null): boolean {
  const radius = Math.max(NEARBY_FLOOR_M, (myAcc ?? UNKNOWN_ACC_M) + (partnerAcc ?? UNKNOWN_ACC_M));
  return radius <= NEARBY_MAX_M && distance <= radius;
}
