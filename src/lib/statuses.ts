// Statuses: a preset and/or text and/or one photo. Photos live in the private
// "statuses" bucket under <user id>/, readable only by the couple (RLS).
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { enqueue, flushQueue } from './queue';
import { fitWithin, MAX_STATUS_TEXT, type StatusRow } from './statusFormat';
import { getProfile, supabase } from './supabase';

export type { StatusRow } from './statusFormat';

export type NewStatus = {
  text: string;
  preset: string | null;
  photo: { uri: string; width: number; height: number } | null;
  at: { lat: number; lng: number } | null;
};

async function uploadPhoto(myId: string, photo: NonNullable<NewStatus['photo']>): Promise<string> {
  const ctx = ImageManipulator.manipulate(photo.uri);
  const size = fitWithin(photo.width, photo.height);
  if (size) ctx.resize(size);
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  const bytes = await new File(saved.uri).arrayBuffer();

  const path = `${myId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('statuses')
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** Post a status and tell the partner. Throws on failure so the screen can say so. */
export async function postStatus(myId: string, partnerId: string | null, s: NewStatus): Promise<void> {
  const photo_path = s.photo ? await uploadPhoto(myId, s.photo) : null;
  const { error } = await supabase.from('statuses').insert({
    text: s.text.trim().slice(0, MAX_STATUS_TEXT) || null,
    preset: s.preset,
    photo_path,
    lat: s.at?.lat ?? null,
    lng: s.at?.lng ?? null,
  });
  if (error) {
    if (photo_path) await supabase.storage.from('statuses').remove([photo_path]).catch(() => undefined);
    throw error;
  }
  if (partnerId) {
    const partner = await getProfile(partnerId).catch(() => null);
    if (partner?.expo_push_token) {
      await enqueue({ kind: 'push', to: partner.expo_push_token, push: 'status' });
      await flushQueue().catch(() => undefined);
    }
  }
}

export async function latestStatus(userId: string): Promise<StatusRow | null> {
  const { data, error } = await supabase
    .from('statuses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as StatusRow | null;
}

// Signed URLs last an hour; reuse them so the same photo isn't re-signed on every render.
const urlCache = new Map<string, { url: string; until: number }>();

export async function photoUrl(path: string): Promise<string | null> {
  const hit = urlCache.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from('statuses').createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
