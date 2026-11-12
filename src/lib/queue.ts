// Offline queue: anything that must reach the server is written here first,
// then flushed. Survives app restarts and works from background tasks.
// Items are removed only after the server accepted them, so a crash or a
// killed background task never loses a point.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendPush, type PushKind } from './push';
import { supabase, type LocationRow } from './supabase';

const KEY = 'queue:v2';
const MAX_ITEMS = 5000; // ~ several weeks of points without network

export type QueuePayload =
  | { kind: 'location'; row: LocationRow }
  | { kind: 'push'; to: string; push: PushKind };

type QueueItem = QueuePayload & { qid: string };

// All read-modify-write on the queue goes through this chain, so an enqueue
// from a background task can never be lost to a concurrent flush.
let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

let flushing: Promise<void> | null = null;
let counter = 0;

async function read(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

async function write(items: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
}

export function enqueue(payload: QueuePayload): Promise<void> {
  return withLock(async () => {
    const items = await read();
    items.push({ ...payload, qid: `${Date.now()}-${counter++}` });
    await write(items);
  });
}

export async function pendingCount(): Promise<number> {
  return (await read()).length;
}

/** Send everything queued. Safe to call often; concurrent calls share one run. */
export function flushQueue(): Promise<void> {
  if (!flushing) {
    flushing = doFlush().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function doFlush(): Promise<void> {
  const snapshot = await withLock(read);
  if (snapshot.length === 0) return;

  const done = new Set<string>();

  const locations = snapshot.filter((i) => i.kind === 'location') as Extract<QueueItem, { kind: 'location' }>[];
  for (let i = 0; i < locations.length; i += 200) {
    const batch = locations.slice(i, i + 200);
    const { error } = await supabase
      .from('locations')
      .upsert(batch.map((b) => b.row), { onConflict: 'user_id,ts', ignoreDuplicates: true });
    if (!error) batch.forEach((b) => done.add(b.qid));
  }

  const pushes = snapshot.filter((i) => i.kind === 'push') as Extract<QueueItem, { kind: 'push' }>[];
  for (const p of pushes) {
    if (await sendPush(p.to, p.push)) done.add(p.qid);
  }

  if (done.size === 0) return;
  await withLock(async () => {
    const current = await read();
    await write(current.filter((i) => !done.has(i.qid)));
  });
}
