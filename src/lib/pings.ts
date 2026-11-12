import { startOfToday } from './format';
import { enqueue, flushQueue } from './queue';
import { getProfile, supabase } from './supabase';

/** Send "thinking of you": a row for the counter, then a push to the partner. */
export async function sendPing(myId: string, partnerId: string): Promise<boolean> {
  const { error } = await supabase.from('pings').insert({ from_id: myId, to_id: partnerId });
  if (error) return false;
  const partner = await getProfile(partnerId).catch(() => null);
  if (partner?.expo_push_token) {
    await enqueue({ kind: 'push', to: partner.expo_push_token, push: 'ping' });
    await flushQueue();
  }
  return true;
}

/** How many pings each side sent today (device's local day). */
export async function todaysPingCounts(myId: string): Promise<{ sent: number; received: number }> {
  const since = new Date(startOfToday()).toISOString();
  const { data, error } = await supabase
    .from('pings')
    .select('from_id')
    .gte('created_at', since);
  if (error || !data) return { sent: 0, received: 0 };
  const sent = data.filter((r) => r.from_id === myId).length;
  return { sent, received: data.length - sent };
}
