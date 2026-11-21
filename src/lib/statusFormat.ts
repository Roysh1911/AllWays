// Pure helpers for statuses, so they run in unit tests.

export type StatusRow = {
  id: number;
  user_id: string;
  created_at: string;
  text: string | null;
  preset: string | null;
  photo_path: string | null;
  lat: number | null;
  lng: number | null;
};

/** Quick statuses. The key is stored; the label can change by OTA without touching old rows. */
export const PRESETS: { key: string; label: string }[] = [
  { key: 'all_good', label: 'הכול טוב 🙂' },
  { key: 'on_the_way', label: 'בדרך 🚌' },
  { key: 'landed', label: 'נחתתי ✈️' },
  { key: 'hiking', label: 'בטרק 🥾' },
  { key: 'no_signal', label: 'אולי בלי קליטה 📵' },
  { key: 'sleeping', label: 'הולך/ת לישון 😴' },
  { key: 'miss_you', label: 'מתגעגע/ת ❤️' },
];

export const MAX_STATUS_TEXT = 280; // matches the DB check constraint

export function presetLabel(key: string | null): string | null {
  if (!key) return null;
  return PRESETS.find((p) => p.key === key)?.label ?? null;
}

/** The line shown for a status: preset and text together, whichever exist. */
export function statusLine(s: Pick<StatusRow, 'text' | 'preset' | 'photo_path'>): string {
  const parts = [presetLabel(s.preset), s.text?.trim() || null].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return s.photo_path ? '📷 תמונה' : '';
}

/** A status needs at least one of: preset, text, photo. */
export function canPost(input: { text: string; preset: string | null; hasPhoto: boolean }): boolean {
  return !!input.preset || input.text.trim().length > 0 || input.hasPhoto;
}

/** Target size for the uploaded photo: longest side at most `max`, never upscaled. */
export function fitWithin(width: number, height: number, max = 1600): { width: number } | { height: number } | null {
  if (width <= max && height <= max) return null;
  return width >= height ? { width: max } : { height: max };
}
