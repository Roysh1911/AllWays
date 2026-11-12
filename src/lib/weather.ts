// Current weather + local time from Open-Meteo (open source, no key).
// Coordinates are rounded to ~1 km before leaving the phone.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WEATHER_CACHE_MS } from './config';
import { coarse, type LatLng } from './geo';

export type Weather = {
  tempC: number;
  code: number;
  utcOffsetSeconds: number;
  fetchedAt: number;
};

const key = (p: LatLng) => `weather:${p.lat},${p.lng}`;

export async function getWeather(at: LatLng): Promise<Weather | null> {
  const p = coarse(at);
  let cached: Weather | null = null;
  try {
    const raw = await AsyncStorage.getItem(key(p));
    cached = raw ? (JSON.parse(raw) as Weather) : null;
  } catch {
    cached = null;
  }
  if (cached && Date.now() - cached.fetchedAt < WEATHER_CACHE_MS) return cached;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lng}` +
      `&current=temperature_2m,weather_code&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return cached;
    const json = (await res.json()) as {
      utc_offset_seconds: number;
      current: { temperature_2m: number; weather_code: number };
    };
    const w: Weather = {
      tempC: Math.round(json.current.temperature_2m),
      code: json.current.weather_code,
      utcOffsetSeconds: json.utc_offset_seconds,
      fetchedAt: Date.now(),
    };
    await AsyncStorage.setItem(key(p), JSON.stringify(w));
    return w;
  } catch {
    return cached; // offline: last known value, the card shows its age
  }
}
