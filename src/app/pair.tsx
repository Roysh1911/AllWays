import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors, radius } from '../components/theme';
import { createPairCode, joinWithCode } from '../lib/pairing';
import { getMyProfile } from '../lib/supabase';

type Mode = 'choose' | 'show' | 'enter';

export default function Pair() {
  const [mode, setMode] = useState<Mode>('choose');
  const [code, setCode] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // While showing a code, wait for the other phone to join.
  useEffect(() => {
    if (mode !== 'show') return;
    const id = setInterval(async () => {
      const me = await getMyProfile().catch(() => null);
      if (me?.partner_id) {
        clearInterval(id);
        router.replace('/permissions');
      }
    }, 2500);
    return () => clearInterval(id);
  }, [mode]);

  async function showCode() {
    setBusy(true);
    setError(null);
    try {
      setCode(await createPairCode());
      setMode('show');
    } catch {
      setError('לא הצלחנו ליצור קוד. נסה/י שוב.');
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true);
    setError(null);
    const res = await joinWithCode(input);
    setBusy(false);
    if (res === 'ok') return router.replace('/permissions');
    setError(
      res === 'invalid_code'
        ? 'הקוד לא נכון או שפג תוקפו.'
        : res === 'already_paired'
          ? 'אחד הטלפונים כבר מחובר.'
          : 'משהו לא עבד. נסה/י שוב.',
    );
  }

  return (
    <Screen>
      <Text style={styles.h1}>חיבור בין שני הטלפונים</Text>

      {mode === 'choose' && (
        <View style={styles.block}>
          <Text style={styles.p}>טלפון אחד מציג קוד, והשני מקליד אותו.</Text>
          <Button title="הצג קוד" onPress={showCode} busy={busy} />
          <Button title="יש לי קוד" variant="secondary" onPress={() => setMode('enter')} />
        </View>
      )}

      {mode === 'show' && code && (
        <View style={styles.block}>
          <Text style={styles.p}>הקלד/י את הקוד הזה בטלפון השני:</Text>
          <Text style={styles.code}>{code}</Text>
          <Text style={styles.small}>ממתין לחיבור…</Text>
        </View>
      )}

      {mode === 'enter' && (
        <View style={styles.block}>
          <TextInput
            value={input}
            onChangeText={(t) => setInput(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="000000"
            placeholderTextColor={colors.stale}
            style={styles.input}
            autoFocus
          />
          <Button title="חיבור" onPress={join} disabled={input.length !== 6} busy={busy} />
          <Button title="חזרה" variant="secondary" onPress={() => setMode('choose')} />
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '800', color: colors.ink, marginTop: 40 },
  block: { gap: 14 },
  p: { fontSize: 17, color: colors.muted },
  code: {
    fontSize: 54,
    fontWeight: '800',
    letterSpacing: 10,
    color: colors.accent,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr',
  },
  small: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    fontSize: 32,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.ink,
    writingDirection: 'ltr',
  },
  error: { color: colors.accent, fontSize: 15 },
});
