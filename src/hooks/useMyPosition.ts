import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import type { LatLng } from '../lib/geo';
import { recordFixes } from '../lib/points';

/** This phone's position while the app is open; also feeds the trail. */
export function useMyPosition(): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(null);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    Location.getLastKnownPositionAsync()
      .then((p) => p && !cancelled && setPos({ lat: p.coords.latitude, lng: p.coords.longitude }))
      .catch(() => undefined);

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
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
