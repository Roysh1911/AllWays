// Public configuration. The anon key is designed to be public: the data is
// protected by Row Level Security on the server, not by hiding this key.
// Never put the service_role key here or anywhere in the app.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://guiljvzvbrivhhkkowri.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_uFqT3Ix9e9YFc-INOdogoA_rkSE3mv8';

// Location tuning (see technical spec, section 3).
export const MIN_DISTANCE_M = 500; // store a point after moving this far...
export const MIN_INTERVAL_MS = 20 * 60 * 1000; // ...or after this much time
export const FENCE_RADIUS_M = 1000; // geofence safety net radius
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // needle turns grey after 6 h
export const LAST_SEEN_EVERY_MS = 10 * 60 * 1000; // heartbeat throttle
export const WEATHER_CACHE_MS = 30 * 60 * 1000;
