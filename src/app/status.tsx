import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors, radius } from '../components/theme';
import { useMyPosition } from '../hooks/useMyPosition';
import { canPost, MAX_STATUS_TEXT, PRESETS } from '../lib/statusFormat';
import { postStatus } from '../lib/statuses';
import { getMyProfile, type Profile } from '../lib/supabase';

type Photo = { uri: string; width: number; height: number };

export default function StatusScreen() {
  const [me, setMe] = useState<Profile | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pos = useMyPosition();

  useEffect(() => {
    getMyProfile().then(setMe).catch(() => undefined);
  }, []);

  async function pick(source: 'camera' | 'library') {
    setError(null);
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(source === 'camera' ? 'אין הרשאה למצלמה. אפשר לאשר בהגדרות.' : 'אין הרשאה לתמונות. אפשר לאשר בהגדרות.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1 };
    const res =
      source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setPhoto({ uri: a.uri, width: a.width, height: a.height });
  }

  async function send() {
    if (!me || busy) return;
    setBusy(true);
    setError(null);
    try {
      await postStatus(me.id, me.partner_id, {
        text,
        preset,
        photo,
        at: pos ? { lat: pos.lat, lng: pos.lng } : null,
      });
      router.back();
    } catch {
      setError('השליחה לא הצליחה. כנראה אין חיבור, אפשר לנסות שוב.');
    } finally {
      setBusy(false);
    }
  }

  const ready = canPost({ text, preset, hasPhoto: !!photo });

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>עדכון סטטוס</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>ביטול</Text>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {PRESETS.map((p) => {
          const on = preset === p.key;
          return (
            <Pressable key={p.key} onPress={() => setPreset(on ? null : p.key)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="מה קורה? (לא חובה)"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={MAX_STATUS_TEXT}
        style={styles.input}
      />
      <Text style={styles.counter}>
        {text.length}/{MAX_STATUS_TEXT}
      </Text>

      {photo ? (
        <View>
          <Image source={{ uri: photo.uri }} style={styles.preview} />
          <Pressable onPress={() => setPhoto(null)} style={styles.remove} hitSlop={8}>
            <Text style={styles.removeText}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button title="📷 צילום" variant="secondary" onPress={() => pick('camera')} />
          </View>
          <View style={styles.flex}>
            <Button title="🖼️ מהגלריה" variant="secondary" onPress={() => pick('library')} />
          </View>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Button title="שליחה" onPress={send} disabled={!ready || !me} busy={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  close: { fontSize: 16, color: colors.accent, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { fontSize: 15, color: colors.ink },
  chipTextOn: { color: colors.accent, fontWeight: '700' },
  input: {
    minHeight: 110,
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    fontSize: 17,
    color: colors.ink,
    textAlignVertical: 'top',
    textAlign: 'right',
  },
  counter: { fontSize: 12, color: colors.muted, marginTop: -10 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius, backgroundColor: colors.line },
  remove: {
    position: 'absolute',
    top: 10,
    start: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { color: colors.accent, fontSize: 15, textAlign: 'center' },
});
