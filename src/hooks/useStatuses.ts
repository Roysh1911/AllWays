import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { latestStatus, type StatusRow } from '../lib/statuses';
import { supabase } from '../lib/supabase';

/** Latest status of each side, kept live via Realtime. */
export function useStatuses(myId: string | null, partnerId: string | null) {
  const [mine, setMine] = useState<StatusRow | null>(null);
  const [theirs, setTheirs] = useState<StatusRow | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (myId) setMine(await latestStatus(myId));
      if (partnerId) setTheirs(await latestStatus(partnerId));
    } catch {
      // offline: keep what we have
    }
  }, [myId, partnerId]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, [refresh]);

  useEffect(() => {
    if (!myId || !partnerId) return;
    const channel = supabase
      .channel(`statuses-${myId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'statuses', filter: `user_id=in.(${myId},${partnerId})` },
        (payload) => {
          const row = payload.new as StatusRow;
          if (row.user_id === myId) setMine(row);
          else setTheirs(row);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, partnerId]);

  return { mine, theirs, refresh };
}
