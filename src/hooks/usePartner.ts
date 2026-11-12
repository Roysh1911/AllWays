import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { todaysPingCounts } from '../lib/pings';
import { flushQueue } from '../lib/queue';
import {
  getMyProfile,
  getProfile,
  latestLocation,
  supabase,
  type LocationRow,
  type Profile,
} from '../lib/supabase';

export type PartnerState = {
  me: Profile | null;
  partner: Profile | null;
  partnerLocation: LocationRow | null;
  pings: { sent: number; received: number };
  loading: boolean;
  refresh: () => Promise<void>;
};

/** Everything the home screen shows about the other side, kept live via Realtime. */
export function usePartner(onPingReceived?: () => void): PartnerState {
  const [me, setMe] = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [partnerLocation, setPartnerLocation] = useState<LocationRow | null>(null);
  const [pings, setPings] = useState({ sent: 0, received: 0 });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const mine = await getMyProfile();
      setMe(mine);
      if (mine?.partner_id) {
        const [p, loc, counts] = await Promise.all([
          getProfile(mine.partner_id),
          latestLocation(mine.partner_id),
          todaysPingCounts(mine.id),
        ]);
        setPartner(p);
        setPartnerLocation(loc);
        setPings(counts);
      }
    } catch {
      // offline: keep what we have
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        refresh();
        flushQueue().catch(() => undefined);
      }
    });
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, [refresh]);

  const partnerId = me?.partner_id ?? null;
  const myId = me?.id ?? null;

  useEffect(() => {
    if (!partnerId || !myId) return;
    const channel = supabase
      .channel(`partner-${partnerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'locations', filter: `user_id=eq.${partnerId}` },
        (payload) => {
          const row = payload.new as LocationRow;
          setPartnerLocation((prev) => (!prev || row.ts > prev.ts ? row : prev));
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${partnerId}` },
        (payload) => setPartner(payload.new as Profile),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pings', filter: `to_id=eq.${myId}` },
        () => {
          setPings((p) => ({ ...p, received: p.received + 1 }));
          onPingReceived?.();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [partnerId, myId, onPingReceived]);

  return { me, partner, partnerLocation, pings, loading, refresh };
}
