import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Profile = {
  id: string;
  name: string;
  partner_id: string | null;
  sharing_paused: boolean;
  expo_push_token: string | null;
  last_seen: string | null;
};

export type LocationRow = {
  id?: number;
  user_id?: string;
  ts: string;
  lat: number;
  lng: number;
  acc: number | null;
  battery: number | null;
  place: string | null;
  source: 'track' | 'fence' | 'foreground';
};

/** Returns the signed-in user id, signing in anonymously on first launch. */
export async function ensureSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signIn.user) throw error ?? new Error('sign-in failed');
  return signIn.user.id;
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function getMyProfile(): Promise<Profile | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function createMyProfile(name: string): Promise<void> {
  const uid = await ensureSession();
  const { error } = await supabase.from('profiles').upsert({ id: uid, name }, { onConflict: 'id' });
  if (error) throw error;
}

export async function updateMyProfile(
  patch: Partial<Pick<Profile, 'name' | 'sharing_paused' | 'expo_push_token' | 'last_seen'>>,
): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;
  const { error } = await supabase.from('profiles').update(patch).eq('id', uid);
  if (error) throw error;
}

export async function latestLocation(userId: string): Promise<LocationRow | null> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('user_id', userId)
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as LocationRow | null;
}
