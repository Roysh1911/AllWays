import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { approachAngle } from '../lib/geo';

export type Heading = { degrees: number; accuracy: number } | null;

/** Device heading from true north, smoothed so the needle doesn't jitter. */
export function useHeading(): Heading {
  const [heading, setHeading] = useState<Heading>(null);
  const smooth = useRef<number | null>(null);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    Location.watchHeadingAsync((h) => {
      const raw = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
      smooth.current = smooth.current === null ? raw : approachAngle(smooth.current, raw, 0.25);
      setHeading({ degrees: smooth.current, accuracy: h.accuracy });
    })
      .then((s) => {
        if (cancelled) s.remove();
        else sub = s;
      })
      .catch(() => setHeading(null));

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  return heading;
}
