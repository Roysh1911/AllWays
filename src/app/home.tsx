import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Compass } from '../components/Compass';
import { Screen } from '../components/Screen';
import { colors, radius } from '../components/theme';
import { WeatherCard } from '../components/WeatherCard';
import { useHeading } from '../hooks/useHeading';
import { useMyPosition } from '../hooks/useMyPosition';
import { usePartner } from '../hooks/usePartner';
import { ensureTracking, stopTracking } from '../lib/backgroundTasks';
import { STALE_AFTER_MS } from '../lib/config';
import { timeAgo } from '../lib/format';
import { bearingDeg, distanceM, formatDistance } from '../lib/geo';
import { sendPing } from '../lib/pings';
import { setPausedLocal } from '../lib/points';
import { updateMyProfile } from '../lib/supabase';

export default function Home() {
  const onPing = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);
  const { me, partner, partnerLocation, pings, refresh } = usePartner(onPing);
  const heading = useHeading();
  const myPos = useMyPosition();
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);

  // Keep "updated X ago" fresh.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const partnerPos = partnerLocation ? { lat: partnerLocation.lat, lng: partnerLocation.lng } : null;

  // "Updated" = the later of the last point and the last heartbeat.
  const lastPoint = partnerLocation ? Date.parse(partnerLocation.ts) : 0;
  const lastSeen = partner?.last_seen ? Date.parse(partner.last_seen) : 0;
  const lastUpdate = Math.max(lastPoint, lastSeen) || null;

  const stale = !lastUpdate || now - lastUpdate > STALE_AFTER_MS || !!partner?.sharing_paused;
  const bearing = myPos && partnerPos ? bearingDeg(myPos, partnerPos) : null;
  const distance = myPos && partnerPos ? distanceM(myPos, partnerPos) : null;
  const lowAccuracy = heading !== null && heading.accuracy <= 1;

  async function ping() {
    if (!me || !partner || sending) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    await sendPing(me.id, partner.id);
    await refresh();
    setSending(false);
  }

  async function togglePause(paused: boolean) {
    await setPausedLocal(paused);
    await updateMyProfile({ sharing_paused: paused }).catch(() => undefined);
    if (paused) await stopTracking();
    else await ensureTracking();
    await refresh();
  }

  const partnerName = partner?.name ?? '';

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.name}>{partnerName}</Text>
        <Text style={styles.sub}>
          {partner?.sharing_paused
            ? 'השיתוף מושהה'
            : partnerLocation?.place
              ? partnerLocation.place
              : 'עוד לא התקבל מיקום'}
        </Text>
        {lastUpdate && !partner?.sharing_paused && (
          <Text style={[styles.small, stale && { color: colors.accent }]}>
            עודכן {timeAgo(lastUpdate, now)}
            {stale ? ' · כנראה אין קליטה' : ''}
          </Text>
        )}
      </View>

      <View style={styles.compass}>
        <Compass heading={heading?.degrees ?? null} bearing={bearing} stale={stale} />
        {lowAccuracy && <Text style={styles.small}>דיוק נמוך: הזז/י את הטלפון בצורת 8 כדי לכייל</Text>}
        {heading === null && <Text style={styles.small}>אין חיישן כיוון זמין. המחוג מכוון לצפון.</Text>}
      </View>

      {distance !== null && <Text style={styles.distance}>{formatDistance(distance)}</Text>}

      <View style={styles.row}>
        <WeatherCard title="אצלך" at={myPos} />
        <WeatherCard title={`אצל ${partnerName}`} at={partnerPos} />
      </View>

      {partnerLocation?.battery != null && (
        <Text style={styles.small}>🔋 {Math.round(partnerLocation.battery * 100)}% אצל {partnerName}</Text>
      )}

      <Pressable onPress={ping} style={({ pressed }) => [styles.ping, pressed && { transform: [{ scale: 0.97 }] }]}>
        <Text style={styles.pingText}>חושב/ת עלייך ❤️</Text>
        <Text style={styles.pingCount}>
          היום: שלחת {pings.sent} · קיבלת {pings.received}
        </Text>
      </Pressable>

      <View style={styles.pause}>
        <Text style={styles.small}>השהיית שיתוף המיקום שלי</Text>
        <Switch
          value={me?.sharing_paused ?? false}
          onValueChange={togglePause}
          trackColor={{ true: colors.accent, false: colors.line }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 4, marginTop: 8 },
  name: { fontSize: 28, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 17, color: colors.ink },
  small: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  compass: { alignItems: 'center', gap: 8 },
  distance: { fontSize: 32, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  ping: {
    backgroundColor: colors.accent,
    borderRadius: radius,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 4,
  },
  pingText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  pingCount: { color: '#fff', fontSize: 14, opacity: 0.9 },
  pause: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
});
