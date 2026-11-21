// Loads a user's trail and their located statuses for the route map.
import type { StatusRow } from './statusFormat';
import { supabase } from './supabase';
import { downsample, type TrailPoint } from './trail';

const MAX_DRAWN = 2000;

export async function loadTrail(userId: string, since: string | null): Promise<TrailPoint[]> {
  let q = supabase.from('locations').select('lat,lng,ts').eq('user_id', userId).order('ts', { ascending: true }).limit(20000);
  if (since) q = q.gte('ts', since);
  const { data, error } = await q;
  if (error) throw error;
  return downsample((data ?? []) as TrailPoint[], MAX_DRAWN);
}

export async function loadLocatedStatuses(userId: string, since: string | null): Promise<StatusRow[]> {
  let q = supabase
    .from('statuses')
    .select('*')
    .eq('user_id', userId)
    .not('lat', 'is', null)
    .order('created_at', { ascending: true })
    .limit(500);
  if (since) q = q.gte('created_at', since);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as StatusRow[];
}
