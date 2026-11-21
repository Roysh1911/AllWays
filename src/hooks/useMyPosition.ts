import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import type { LatLng } from '../lib/geo';
import { recordFixes } from '../lib/points';

export type MyPosition = LatLng & { acc: number | null };

/** This phone's position while the app is open; also feeds the trail. */
export function useMyPosition(): MyPosition | null {
  const [pos, setPos] = useState<MyPosition | null>(null);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    Location.getLastKnownPositionAsync()
      .then((p) => p && !cancelled && setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy ?? null }))
      .catch(() => undefined);

    Location.watchPositionAsync(
      // High, not Balanced: on iOS Balanced means ~100 m, which swamps the needle at short range.
      // Only runs while the app is open, so the battery cost is small.
      { accuracy: Location.Accuracy.High, distanceInterval: 20 },
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy ?? null });
        recordFixes([p], 'foreground').catch(() => undefined);
      },
    )
      .then((s) => {
        if (cancelled) s.remove();
        else sub = s;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  return pos;
}
