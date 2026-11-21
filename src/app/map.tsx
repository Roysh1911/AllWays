import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../components/theme';
import { statusLine, type StatusRow } from '../lib/statusFormat';
import { getMyProfile, getProfile } from '../lib/supabase';
import { RANGES, rangeStart, segments, type Range, type TrailPoint } from '../lib/trail';
import { loadLocatedStatuses, loadTrail } from '../lib/trailQuery';

const EDGE = { top: 120, right: 40, bottom: 80, left: 40 };

export default function RouteMap() {
  const map = useRef<MapView>(null);
  const [range, setRange] = useState<Range>('week');
  const [name, setName] = useState('');
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async (r: Range) => {
    setState('loading');
    try {
      const me = await getMyProfile();
      if (!me?.partner_id) throw new Error('not paired');
      const since = rangeStart(r);
      const [p, t, s] = await Promise.all([
        getProfile(me.partner_id),
        loadTrail(me.partner_id, since),
        loadLocatedStatuses(me.partner_id, since),
      ]);
      setName(p?.name ?? '');
      setTrail(t);
      setStatuses(s);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => load(range), 0);
    return () => clearTimeout(id);
  }, [load, range]);

  const segs = useMemo(() => segments(trail), [trail]);
  const last = trail.length ? trail[trail.length - 1] : null;

  // Frame everything once the data is in.
  useEffect(() => {
    if (state !== 'ready' || !map.current) return;
    const coords = trail.map((p) => ({ latitude: p.lat, longitude: p.lng }));
    if (coords.length === 1) {
      map.current.animateToRegion({ ...coords[0], latitudeDelta: 0.05, longitudeDelta: 0.05 });
    } else if (coords.length > 1) {
      map.current.fitToCoordinates(coords, { edgePadding: EDGE, animated: true });
    }
  }, [state, trail]);

  return (
    <View style={styles.root}>
      <MapView ref={map} style={StyleSheet.absoluteFill} showsUserLocation showsCompass={false}>
        {segs.map((s, i) => (
          <Polyline
            key={`${range}-${i}`}
            coordinates={s.points.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={s.jump ? colors.muted : colors.accent}
            strokeWidth={s.jump ? 2 : 4}
            lineDashPattern={s.jump ? [8, 8] : undefined}
          />
        ))}
        {statuses.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat as number, longitude: s.lng as number }}
            title={statusLine(s) || 'סטטוס'}
            description={new Date(s.created_at).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short' })}
          >
            <View style={styles.pin}>
              <Text style={styles.pinText}>{s.photo_path ? '📷' : '💬'}</Text>
            </View>
          </Marker>
        ))}
        {last && (
          <Marker coordinate={{ latitude: last.lat, longitude: last.lng }} title={name} anchor={{ x: 0.5, y: 0.5 }}>
            <Text style={styles.heart}>❤️</Text>
          </Marker>
        )}
      </MapView>

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <View style={styles.bar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>סגירה</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            המסלול של {name}
          </Text>
          <View style={styles.backSpacer} />
        </View>
        <View style={styles.ranges}>
          {RANGES.map((r) => {
            const on = r.key === range;
            return (
              <Pressable key={r.key} onPress={() => setRange(r.key)} style={[styles.range, on && styles.rangeOn]}>
                <Text style={[styles.rangeText, on && styles.rangeTextOn]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {state === 'loading' && <ActivityIndicator color={colors.accent} style={styles.note} />}
        {state === 'error' && <Text style={[styles.note, styles.noteText]}>לא הצלחתי לטעון. כנראה אין חיבור.</Text>}
        {state === 'ready' && trail.length === 0 && (
          <Text style={[styles.note, styles.noteText]}>אין מיקומים בטווח הזה</Text>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, gap: 10 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  back: { fontSize: 16, color: colors.accent, fontWeight: '600', width: 56 },
  backSpacer: { width: 56 },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  ranges: { flexDirection: 'row', alignSelf: 'center', backgroundColor: colors.card, borderRadius: 999, padding: 4, gap: 4 },
  range: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 999 },
  rangeOn: { backgroundColor: colors.accent },
  rangeText: { fontSize: 15, color: colors.ink },
  rangeTextOn: { color: '#fff', fontWeight: '700' },
  note: { alignSelf: 'center' },
  noteText: {
    backgroundColor: colors.card,
    color: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 14,
  },
  pin: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pinText: { fontSize: 16 },
  heart: { fontSize: 28 },
});
