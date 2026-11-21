import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  approachAngle,
  bearingDeg,
  coarse,
  distanceM,
  formatDistance,
  isNearby,
  needleRotation,
  norm180,
  shouldStore,
} from '../src/lib/geo.ts';
import { clockAt, timeAgo, weatherLabel } from '../src/lib/format.ts';

const telAviv = { lat: 32.0853, lng: 34.7818 };
const kathmandu = { lat: 27.7172, lng: 85.324 };
const bangkok = { lat: 13.7563, lng: 100.5018 };
const london = { lat: 51.5074, lng: -0.1278 };

test('distance Tel Aviv → Kathmandu ≈ 4,850 km', () => {
  const km = distanceM(telAviv, kathmandu) / 1000;
  assert.ok(Math.abs(km - 4850) < 40, `got ${km}`);
});

test('distance London → Tel Aviv ≈ 3,580 km', () => {
  const km = distanceM(london, telAviv) / 1000;
  assert.ok(Math.abs(km - 3580) < 40, `got ${km}`);
});

test('bearing: due north / east / south / west', () => {
  const o = { lat: 0, lng: 0 };
  assert.ok(Math.abs(bearingDeg(o, { lat: 10, lng: 0 }) - 0) < 1e-9);
  assert.ok(Math.abs(bearingDeg(o, { lat: 0, lng: 10 }) - 90) < 1e-9);
  assert.ok(Math.abs(bearingDeg(o, { lat: -10, lng: 0 }) - 180) < 1e-9);
  assert.ok(Math.abs(bearingDeg(o, { lat: 0, lng: -10 }) - 270) < 1e-9);
});

test('bearing Tel Aviv → Bangkok is roughly east-south-east (~95–105°)', () => {
  const b = bearingDeg(telAviv, bangkok);
  assert.ok(b > 90 && b < 110, `got ${b}`);
});

test('bearing Bangkok → Tel Aviv is roughly west-north-west (~290–305°)', () => {
  const b = bearingDeg(bangkok, telAviv);
  assert.ok(b > 285 && b < 310, `got ${b}`);
});

test('needle rotation subtracts heading and wraps', () => {
  assert.equal(needleRotation(90, 0), 90);
  assert.equal(needleRotation(10, 350), 20);
  assert.equal(needleRotation(350, 10), 340);
});

test('smoothing takes the short way across north', () => {
  const next = approachAngle(350, 10, 0.5);
  assert.equal(next, 360); // halfway through the 20° gap, not 180°
  assert.equal(norm180(approachAngle(10, 350, 0.5)), 0);
});

test('coarse rounds to 2 decimals', () => {
  assert.deepEqual(coarse({ lat: 32.08531, lng: 34.78179 }), { lat: 32.09, lng: 34.78 });
});

test('shouldStore: 500 m or 20 min', () => {
  const min20 = 20 * 60 * 1000;
  const last = { ...telAviv, ts: 0 };
  assert.equal(shouldStore(null, last, 500, min20), true);
  assert.equal(shouldStore(last, { ...telAviv, ts: 60_000 }, 500, min20), false); // same spot, 1 min
  assert.equal(shouldStore(last, { lat: telAviv.lat + 0.01, lng: telAviv.lng, ts: 60_000 }, 500, min20), true); // ~1.1 km
  assert.equal(shouldStore(last, { ...telAviv, ts: min20 }, 500, min20), true); // 20 min
});

test('formatDistance in Hebrew', () => {
  assert.equal(formatDistance(420), "420 מ'");
  assert.equal(formatDistance(4200), '4.2 ק"מ');
  assert.match(formatDistance(4_980_000), /^4,980 ק"מ$/);
});

test('timeAgo in Hebrew', () => {
  const now = 1_000_000_000;
  assert.equal(timeAgo(now - 10_000, now), 'עכשיו');
  assert.equal(timeAgo(now - 5 * 60_000, now), 'לפני 5 דקות');
  assert.equal(timeAgo(now - 2 * 3_600_000, now), 'לפני שעתיים');
  assert.equal(timeAgo(now - 5 * 3_600_000, now), 'לפני 5 שעות');
  assert.equal(timeAgo(now - 2 * 86_400_000, now), 'לפני יומיים');
});

test('clockAt uses the place offset, not the device zone', () => {
  const utcNoon = Date.UTC(2026, 11, 1, 12, 0);
  assert.equal(clockAt(0, utcNoon), '12:00');
  assert.equal(clockAt(5.75 * 3600, utcNoon), '17:45'); // Nepal +05:45
  assert.equal(clockAt(2 * 3600, utcNoon), '14:00'); // Israel winter
});

test('weatherLabel covers common codes', () => {
  assert.equal(weatherLabel(0).label, 'בהיר');
  assert.equal(weatherLabel(63).label, 'גשם');
  assert.equal(weatherLabel(95).label, 'סופה');
});

test('isNearby: the bug case — 16 m apart, 58 m accuracy', () => {
  assert.equal(isNearby(16, 58, 6), true);
});

test('isNearby: far apart with good fixes', () => {
  assert.equal(isNearby(1000, 10, 10), false);
  assert.equal(isNearby(65, 30, 30), false);
});

test('isNearby: unknown accuracy uses a safe default', () => {
  assert.equal(isNearby(100, null, null), true); // 65 + 65 = 130
  assert.equal(isNearby(200, null, null), false);
});

test('isNearby: never "next to you" when the fixes are hopeless', () => {
  assert.equal(isNearby(250, 200, 200), false); // 400 m uncertainty > cap
});

test('isNearby: floor for very precise fixes', () => {
  assert.equal(isNearby(20, 3, 3), true); // floor 30 m
});

test('widgetProps: far apart', async () => {
  const { widgetProps } = await import('../src/lib/widgetProps.ts');
  const p = widgetProps({
    partnerName: 'נועה',
    paused: false,
    me: telAviv,
    partner: { ...kathmandu, acc: 20, ts: '2026-12-10T10:00:00Z', place: 'קטמנדו' },
    partnerLastSeen: '2026-12-10T11:00:00Z',
  });
  assert.equal(p.name, 'נועה');
  assert.equal(p.nearby, false);
  assert.match(p.distance ?? '', /ק"מ$/);
  assert.equal(p.place, 'קטמנדו');
  assert.equal(p.updatedAt, Date.parse('2026-12-10T11:00:00Z')); // later of point and heartbeat
});

test('widgetProps: nearby and missing data', async () => {
  const { widgetProps } = await import('../src/lib/widgetProps.ts');
  const near = widgetProps({
    partnerName: 'נועה',
    paused: false,
    me: { ...telAviv, acc: 10 },
    partner: { lat: telAviv.lat + 0.0001, lng: telAviv.lng, acc: 10, ts: '2026-12-10T10:00:00Z', place: null },
    partnerLastSeen: null,
  });
  assert.equal(near.nearby, true);
  const empty = widgetProps({ partnerName: null, paused: true, me: null, partner: null, partnerLastSeen: null });
  assert.deepEqual(empty, { name: '', distance: '', nearby: false, place: '', updatedAt: 0, paused: true });
});

test('statusLine combines preset, text and photo fallback', async () => {
  const { statusLine, presetLabel } = await import('../src/lib/statusFormat.ts');
  assert.equal(presetLabel('landed'), 'נחתתי ✈️');
  assert.equal(presetLabel('nope'), null);
  assert.equal(statusLine({ preset: 'landed', text: ' הכול בסדר ', photo_path: null }), 'נחתתי ✈️ · הכול בסדר');
  assert.equal(statusLine({ preset: null, text: '', photo_path: 'u/1.jpg' }), '📷 תמונה');
  assert.equal(statusLine({ preset: 'unknown', text: null, photo_path: null }), '');
});

test('canPost needs preset, text or photo', async () => {
  const { canPost } = await import('../src/lib/statusFormat.ts');
  assert.equal(canPost({ text: '   ', preset: null, hasPhoto: false }), false);
  assert.equal(canPost({ text: 'היי', preset: null, hasPhoto: false }), true);
  assert.equal(canPost({ text: '', preset: 'hiking', hasPhoto: false }), true);
  assert.equal(canPost({ text: '', preset: null, hasPhoto: true }), true);
});

test('fitWithin never upscales and keeps the longest side', async () => {
  const { fitWithin } = await import('../src/lib/statusFormat.ts');
  assert.equal(fitWithin(1200, 900), null);
  assert.deepEqual(fitWithin(4032, 3024), { width: 1600 });
  assert.deepEqual(fitWithin(3024, 4032), { height: 1600 });
});

test('segments: solid runs and dashed jumps', async () => {
  const { segments } = await import('../src/lib/trail.ts');
  const a = { lat: 27.7, lng: 85.3 };
  const b = { lat: 27.701, lng: 85.301 };
  const c = { lat: 27.702, lng: 85.302 };
  const far = { lat: 13.75, lng: 100.5 }; // Bangkok
  const far2 = { lat: 13.751, lng: 100.501 };
  const s = segments([a, b, c, far, far2]);
  assert.equal(s.length, 3);
  assert.deepEqual(s.map((x) => x.jump), [false, true, false]);
  assert.deepEqual(s[1].points, [c, far]);
  assert.equal(segments([a]).length, 0);
});

test('downsample keeps ends and the cap', async () => {
  const { downsample } = await import('../src/lib/trail.ts');
  const pts = Array.from({ length: 101 }, (_, i) => i);
  const d = downsample(pts, 11);
  assert.equal(d.length, 11);
  assert.equal(d[0], 0);
  assert.equal(d[10], 100);
  assert.deepEqual(downsample([1, 2, 3], 10), [1, 2, 3]);
});

test('rangeStart', async () => {
  const { rangeStart } = await import('../src/lib/trail.ts');
  const now = Date.UTC(2026, 11, 10, 12);
  assert.equal(rangeStart('day', now), '2026-12-09T12:00:00.000Z');
  assert.equal(rangeStart('all', now), null);
});

test('widget props never contain null (UserDefaults crashes on NSNull)', async () => {
  const { widgetProps, plistSafe, EMPTY_WIDGET } = await import('../src/lib/widgetProps.ts');
  const noNull = (o: Record<string, unknown>) => Object.values(o).every((v) => v !== null && v !== undefined);
  assert.ok(noNull(EMPTY_WIDGET));
  assert.ok(noNull(widgetProps({ partnerName: null, paused: false, me: null, partner: null, partnerLastSeen: null })));
  assert.ok(
    noNull(
      widgetProps({
        partnerName: 'נועה',
        paused: false,
        me: telAviv,
        partner: { ...kathmandu, acc: null, ts: 'not a date', place: null },
        partnerLastSeen: null,
      }),
    ),
  );
  assert.deepEqual(plistSafe({ a: 1, b: null, c: undefined, d: NaN, e: '' } as Record<string, unknown>), { a: 1, e: '' });
});
