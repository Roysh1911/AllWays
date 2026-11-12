// Push notifications, sent straight from the phone to the Expo Push API.
// No server code. Payloads carry no location and no photo.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { updateMyProfile } from './supabase';

export type PushKind = 'ping' | 'status';

const MESSAGES: Record<PushKind, { title: string; body: string; sound: string }> = {
  ping: { title: '❤️', body: 'חושב/ת עלייך', sound: 'heart.wav' },
  status: { title: 'סטטוס חדש', body: 'פתח/י לראות', sound: 'default' },
};

/** Ask for permission, get this phone's Expo push token and save it to the profile. */
export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) return null;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await updateMyProfile({ expo_push_token: token });
  return token;
}

/** Returns true when Expo accepted the message (or the token is hopeless, so don't retry). */
export async function sendPush(to: string, kind: PushKind): Promise<boolean> {
  const m = MESSAGES[kind];
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        title: m.title,
        body: m.body,
        sound: m.sound,
        priority: 'high',
        data: { kind },
      }),
    });
    if (!res.ok) return res.status >= 400 && res.status < 500; // 4xx: bad request, drop it
    const json = (await res.json()) as { data?: { status?: string; details?: { error?: string } } };
    if (json.data?.status === 'ok') return true;
    // Token no longer valid: retrying won't help.
    return json.data?.details?.error === 'DeviceNotRegistered';
  } catch {
    return false; // network error: keep it in the queue
  }
}
