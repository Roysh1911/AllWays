// What the home-screen widget shows. Pure, so it runs in unit tests.
//
// NO null VALUES ANYWHERE. expo-widgets stores props in iOS UserDefaults, which
// raises an uncatchable exception on null (NSNull is not a property-list type)
// and crashes the app at launch. Use '' and 0 for "none".
// The widget can't fetch anything itself: the app computes these props
// (in the foreground, and from the background location task) and pushes them.
import { distanceM, formatDistance, isNearby, type LatLng } from './geo.ts';

export type PartnerWidgetProps = {
  /** Partner's display name. Empty before pairing. */
  name: string;
  /** "4,850 ק"מ", or '' when either side has no location yet. */
  distance: string;
  /** Closer than the location error: show "ממש לידך" instead of a number. */
  nearby: boolean;
  /** Partner's city/place, or ''. */
  place: string;
  /** When the partner was last heard from (ms since epoch), 0 if never. */
  updatedAt: number;
  /** Partner paused sharing. */
  paused: boolean;
};

export const EMPTY_WIDGET: PartnerWidgetProps = {
  name: '',
  distance: '',
  nearby: false,
  place: '',
  updatedAt: 0,
  paused: false,
};

export type WidgetInput = {
  partnerName: string | null;
  paused: boolean;
  me: (LatLng & { acc?: number | null }) | null;
  partner: (LatLng & { acc?: number | null; ts: string; place: string | null }) | null;
  partnerLastSeen: string | null;
};

export function widgetProps(input: WidgetInput): PartnerWidgetProps {
  const { me, partner } = input;
  const lastPoint = partner ? Date.parse(partner.ts) : 0;
  const lastSeen = input.partnerLastSeen ? Date.parse(input.partnerLastSeen) : 0;
  const updatedAt = Math.max(lastPoint || 0, lastSeen || 0);

  let distance = '';
  let nearby = false;
  if (me && partner) {
    const d = distanceM(me, partner);
    nearby = isNearby(d, me.acc ?? null, partner.acc ?? null);
    distance = formatDistance(d);
  }

  return {
    name: input.partnerName ?? '',
    distance,
    nearby,
    place: partner?.place ?? '',
    updatedAt,
    paused: input.paused,
  };
}

/** Last line of defence: drop any null/undefined/non-finite value before it reaches UserDefaults. */
export function plistSafe<T extends Record<string, unknown>>(props: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    out[k] = v;
  }
  return out as T;
}

/** Stable key so we only touch the widget when something visible changed. */
export function widgetKey(p: PartnerWidgetProps): string {
  return JSON.stringify(p);
}
