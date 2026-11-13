import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../components/theme';
import { ensureTracking } from '../lib/backgroundTasks';
import { registerForPush } from '../lib/push';

export default function Permissions() {
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  async function allow() {
    setBusy(true);
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') return setDenied(true);
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== 'granted') return setDenied(true);
      await registerForPush().catch(() => null);
      await ensureTracking();
      router.replace('/home');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.h1}>שתי הרשאות קטנות</Text>
      <Text style={styles.p}>
        📍 מיקום ״תמיד״: כדי שהמצפן בטלפון השני יצביע אלייך גם כשהאפליקציה סגורה.
      </Text>
      <Text style={styles.p}>🔔 התראות: כדי לקבל ❤️ כשחושבים עלייך.</Text>
      <Text style={styles.small}>
        מדי פעם iPhone ישאל אם להמשיך לשתף מיקום ברקע. זה רגיל, ואפשר לאשר.
      </Text>

      {denied ? (
        <>
          <Text style={styles.warn}>
            בלי מיקום ״תמיד״ המצפן אצל הצד השני לא יתעדכן. אפשר לשנות בהגדרות ← AllWays ← מיקום ← תמיד.
          </Text>
          <Button title="פתיחת ההגדרות" onPress={() => Linking.openSettings()} />
          <Button title="בדיקה שוב" variant="secondary" onPress={allow} busy={busy} />
        </>
      ) : (
        <Button title="אישור" onPress={allow} busy={busy} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: colors.ink, marginTop: 40 },
  p: { fontSize: 17, color: colors.ink, lineHeight: 26 },
  small: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  warn: { fontSize: 16, color: colors.accent, lineHeight: 24 },
});
