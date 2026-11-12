import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors } from '../components/theme';
import { ensureTracking } from '../lib/backgroundTasks';
import { ensureSession, getMyProfile } from '../lib/supabase';

/** Decides where to go: welcome → pair → permissions → home. */
export default function Gate() {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureSession();
        const me = await getMyProfile();
        if (!alive) return;
        if (!me) return router.replace('/welcome');
        if (!me.partner_id) return router.replace('/pair');
        const bg = await Location.getBackgroundPermissionsAsync();
        if (bg.status !== 'granted') return router.replace('/permissions');
        await ensureTracking();
        router.replace('/home');
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  return (
    <View style={styles.center}>
      {failed ? (
        <>
          <Text style={styles.text}>אין חיבור לשרת כרגע.</Text>
          <Button
            title="לנסות שוב"
            variant="secondary"
            onPress={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          />
        </>
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: colors.bg },
  text: { fontSize: 17, color: colors.ink },
});
