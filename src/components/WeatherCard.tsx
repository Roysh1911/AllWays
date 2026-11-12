import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { clockAt, weatherLabel } from '../lib/format';
import type { LatLng } from '../lib/geo';
import { getWeather, type Weather } from '../lib/weather';
import { colors, radius } from './theme';

/** Local time + temperature at a place. */
export function WeatherCard({ title, at }: { title: string; at: LatLng | null }) {
  const [w, setW] = useState<Weather | null>(null);
  const [, tick] = useState(0);

  const lat = at?.lat;
  const lng = at?.lng;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    let alive = true;
    getWeather({ lat, lng }).then((res) => alive && setW(res));
    return () => {
      alive = false;
    };
  }, [lat, lng]);

  // Re-render every 30 s so the clock stays right.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const label = w ? weatherLabel(w.code) : null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.clock}>{w ? clockAt(w.utcOffsetSeconds) : '--:--'}</Text>
      <Text style={styles.weather}>
        {w && label ? `${label.icon} ${w.tempC}°` : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: { fontSize: 14, color: colors.muted, marginBottom: 4 },
  clock: { fontSize: 28, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  weather: { fontSize: 18, color: colors.ink, marginTop: 2 },
});
