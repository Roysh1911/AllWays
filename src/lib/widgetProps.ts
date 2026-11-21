// What the home-screen widget shows. Pure, so it runs in unit tests.
// The widget can't fetch anything itself: the app computes these props
// (in the foreground, and from the background location task) and pushes them.
import { distanceM, formatDistance, isNearby, type LatLng } from './geo.ts';

export type PartnerWidgetProps = {
  /** Partner's display name. Empty before pairing. */
  name: string;
  /** "4,850 ק"מ", or null when either side has no location yet. */
  distance: string | null;
  /** Closer than the location error: show "ממש לידך" instead of a number. */
  nearby: boolean;
  /** Partner's city/place, if known. */
  place: string | null;
  /** When the partner was last heard from (ms since epoch), for a live "updated X ago". */
  updatedAt: number | null;
  /** Partner paused sharing. */
  paused: boolean;
};

export const EMPTY_WIDGET: PartnerWidgetProps = {
  name: '',
  distance: null,
  nearby: false,
  place: null,
  updatedAt: null,
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
  const updatedAt = Math.max(lastPoint || 0, lastSeen || 0) || null;

  let distance: string | null = null;
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
    place: partner?.place ?? null,
    updatedAt,
    paused: input.paused,
  };
}

/** Stable key so we only touch the widget when something visible changed. */
export function widgetKey(p: PartnerWidgetProps): string {
  return JSON.stringify(p);
}
