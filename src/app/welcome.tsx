import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors, radius } from '../components/theme';
import { createMyProfile } from '../lib/supabase';

export default function Welcome() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await createMyProfile(name.trim());
      router.replace('/pair');
    } catch {
      setError('משהו לא עבד. בדוק/י חיבור לאינטרנט ונסה/י שוב.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>🧭</Text>
      <Text style={styles.h1}>AllWays</Text>
      <Text style={styles.p}>מצפן שתמיד מצביע אל האדם שלך, איפה שלא תהיו.</Text>
      <Text style={styles.label}>איך לקרוא לך?</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="השם שלך"
        placeholderTextColor={colors.muted}
        style={styles.input}
        maxLength={40}
        autoFocus
        textAlign="right"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="המשך" onPress={save} disabled={name.trim().length === 0} busy={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 64, textAlign: 'center', marginTop: 40 },
  h1: { fontSize: 34, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  p: { fontSize: 17, color: colors.muted, textAlign: 'center', marginBottom: 24 },
  label: { fontSize: 16, color: colors.ink, fontWeight: '600' },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    fontSize: 18,
    color: colors.ink,
  },
  error: { color: colors.accent, fontSize: 15 },
});
