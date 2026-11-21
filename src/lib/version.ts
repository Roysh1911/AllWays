// One readable line saying exactly what code this phone runs:
// "native-2 · preview · מובנה" or "native-2 · preview · עדכון 22.11 01:10".
import * as Updates from 'expo-updates';

export function versionLine(): string {
  const parts = [Updates.runtimeVersion ?? 'dev', Updates.channel ?? '-'];
  if (Updates.isEmbeddedLaunch || !Updates.createdAt) {
    parts.push('מובנה');
  } else {
    const d = Updates.createdAt;
    const pad = (n: number) => String(n).padStart(2, '0');
    parts.push(`עדכון ${d.getDate()}.${d.getMonth() + 1} ${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }
  return parts.join(' · ');
}
