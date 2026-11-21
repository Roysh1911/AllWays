import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { timeAgo } from '../lib/format';
import { statusLine } from '../lib/statusFormat';
import { photoUrl, type StatusRow } from '../lib/statuses';
import { colors, radius } from './theme';

function usePhoto(path: string | null | undefined): string | null {
  const [loaded, setLoaded] = useState<{ path: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    photoUrl(path)
      .then((url) => alive && setLoaded({ path, url }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [path]);
  // Derive instead of resetting in the effect: a stale URL for an old path is never shown.
  return path && loaded?.path === path ? loaded.url : null;
}

type Props = { partnerName: string; theirs: StatusRow | null; mine: StatusRow | null; now: number };

/** Partner's latest status (with photo), my own in one line, and a button to post. */
export function StatusCard({ partnerName, theirs, mine, now }: Props) {
  const url = usePhoto(theirs?.photo_path);
  const [full, setFull] = useState(false);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>הסטטוס של {partnerName}</Text>
      {theirs ? (
        <View style={styles.row}>
          {url && (
            <Pressable onPress={() => setFull(true)}>
              <Image source={{ uri: url }} style={styles.thumb} />
            </Pressable>
          )}
          <View style={styles.body}>
            <Text style={styles.text}>{statusLine(theirs)}</Text>
            <Text style={styles.small}>{timeAgo(Date.parse(theirs.created_at), now)}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.small}>עוד אין סטטוס</Text>
      )}

      <View style={styles.divider} />

      <Pressable onPress={() => router.push('/status')} style={styles.mineRow}>
        <Text style={styles.small} numberOfLines={1}>
          {mine ? `שלי: ${statusLine(mine)} · ${timeAgo(Date.parse(mine.created_at), now)}` : 'עוד לא עדכנת סטטוס'}
        </Text>
        <Text style={styles.link}>עדכון ›</Text>
      </Pressable>

      <Modal visible={full && !!url} transparent animationType="fade" onRequestClose={() => setFull(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFull(false)}>
          {url && <Image source={{ uri: url }} style={styles.full} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius, padding: 16, gap: 10 },
  title: { fontSize: 14, color: colors.muted },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.line },
  body: { flex: 1, gap: 4 },
  text: { fontSize: 18, fontWeight: '700', color: colors.ink },
  small: { fontSize: 14, color: colors.muted, flexShrink: 1 },
  divider: { height: 1, backgroundColor: colors.line },
  mineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  link: { fontSize: 15, fontWeight: '700', color: colors.accent },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  full: { width: '100%', height: '80%' },
});
