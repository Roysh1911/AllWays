// Turning raw location fixes into stored points, from foreground or background.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import { LAST_SEEN_EVERY_MS, MIN_DISTANCE_M, MIN_INTERVAL_MS } from './config';
import { distanceM, shouldStore, type LatLng } from './geo';
import { enqueue, flushQueue } from './queue';
import { currentUserId, getMyProfile, updateMyProfile, type LocationRow } from './supabase';

const LAST_POINT = 'points:last';
const LAST_PLACE = 'points:lastPlace';
const LAST_SEEN = 'points:lastSeen';
const PAUSED = 'points:paused';

type Stored = LatLng & { ts: number };
type PlaceCache = LatLng & { ts: number; place: string | null };

async function getJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Local mirror of profiles.sharing_paused, readable without network. */
export async function setPausedLocal(paused: boolean): Promise<void> {
  await AsyncStorage.setItem(PAUSED, paused ? '1' : '0');
}

export async function isPausedLocal(): Promise<boolean> {
  const v = await AsyncStorage.getItem(PAUSED);
  if (v !== null) return v === '1';
  try {
    const p = await getMyProfile();
    return p?.sharing_paused ?? false;
  } catch {
    return false;
  }
}

/** City, country — re-geocoded only after moving 2 km or after an hour. */
async function placeFor(p: LatLng, ts: number): Promise<string | null> {
  const cached = await getJson<PlaceCache>(LAST_PLACE);
  if (cached && distanceM(cached, p) < 2000 && ts - cached.ts < 60 * 60 * 1000) {
    return cached.place;
  }
  try {
    const [addr] = await Location.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lng });
    const place = addr ? [addr.city ?? addr.region, addr.country].filter(Boolean).join(', ') || null : null;
    await AsyncStorage.setItem(LAST_PLACE, JSON.stringify({ ...p, ts, place }));
    return place;
  } catch {
    return cached?.place ?? null;
  }
}

async function batteryLevel(): Promise<number | null> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    return level >= 0 ? level : null;
  } catch {
    return null;
  }
}

/** Heartbeat: "the phone checked in", even when the point itself is filtered out. */
async function touchLastSeen(now: number): Promise<void> {
  const last = Number((await AsyncStorage.getItem(LAST_SEEN)) ?? 0);
  if (now - last < LAST_SEEN_EVERY_MS) return;
  await AsyncStorage.setItem(LAST_SEEN, String(now));
  try {
    await updateMyProfile({ last_seen: new Date(now).toISOString() });
  } catch {
    // offline: next heartbeat will try again
  }
}

/**
 * Consider a batch of fixes and store the ones that pass the 500 m / 20 min filter.
 * `force` stores the newest fix regardless (used by the geofence safety net).
 */
export async function recordFixes(
  fixes: Location.LocationObject[],
  source: LocationRow['source'],
  force = false,
): Promise<void> {
  if (fixes.length === 0) return;
  const uid = await currentUserId();
  if (!uid) return;
  if (await isPausedLocal()) return;

  const sorted = [...fixes].sort((a, b) => a.timestamp - b.timestamp);
  let last = await getJson<Stored>(LAST_POINT);
  let stored = 0;

  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i];
    const next: Stored = { lat: f.coords.latitude, lng: f.coords.longitude, ts: f.timestamp };
    const isNewest = i === sorted.length - 1;
    if (!(shouldStore(last, next, MIN_DISTANCE_M, MIN_INTERVAL_MS) || (force && isNewest))) continue;

    const row: LocationRow = {
      user_id: uid,
      ts: new Date(next.ts).toISOString(),
      lat: next.lat,
      lng: next.lng,
      acc: f.coords.accuracy ?? null,
      battery: isNewest ? await batteryLevel() : null,
      place: isNewest ? await placeFor(next, next.ts) : null,
      source,
    };
    await enqueue({ kind: 'location', row });
    last = next;
    stored++;
  }

  if (stored > 0) await AsyncStorage.setItem(LAST_POINT, JSON.stringify(last));
  await touchLastSeen(Date.now());
  await flushQueue();
}

export async function lastStoredPoint(): Promise<Stored | null> {
  return getJson<Stored>(LAST_POINT);
}

/** Forget local history (after the user deletes the trail on the server). */
export async function resetLocalPoints(): Promise<void> {
  await AsyncStorage.multiRemove([LAST_POINT, LAST_PLACE]);
}
