// Pushes fresh data to the home-screen widget. Never throws: a widget problem
// must not break location tracking or the home screen.
import { Platform } from 'react-native';
import PartnerWidget from '../widgets/PartnerWidget';
import { lastStoredPoint } from './points';
import { getMyProfile, getProfile, latestLocation } from './supabase';
import { widgetKey, widgetProps, type PartnerWidgetProps, type WidgetInput } from './widgetProps';

let lastKey: string | null = null;

export function pushWidget(input: WidgetInput): void {
  if (Platform.OS !== 'ios') return;
  try {
    const props: PartnerWidgetProps = widgetProps(input);
    const key = widgetKey(props);
    if (key === lastKey) return;
    PartnerWidget.updateSnapshot(props);
    lastKey = key;
  } catch {
    // widget extension missing or storage unavailable: ignore
  }
}

/** Background path: fetch the partner's latest state and refresh the widget. */
export async function refreshWidgetFromServer(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const me = await getMyProfile();
    if (!me?.partner_id) return;
    const [partner, loc, mine] = await Promise.all([
      getProfile(me.partner_id),
      latestLocation(me.partner_id),
      lastStoredPoint(),
    ]);
    pushWidget({
      partnerName: partner?.name ?? null,
      paused: !!partner?.sharing_paused,
      me: mine,
      partner: loc,
      partnerLastSeen: partner?.last_seen ?? null,
    });
  } catch {
    // offline in the background: keep what the widget already shows
  }
}
