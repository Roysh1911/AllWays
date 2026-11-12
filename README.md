# The Compass

A private two-person iPhone app: a compass whose needle always points to your partner,
plus distance, local time and weather on both sides, "thinking of you" pings and a trail map.

Specs: [product (Hebrew)](https://claude.ai/artifact/4Kgt1eM4AGf3NK8Pw1q5Jg) ·
[technical](https://claude.ai/artifact/V4Nk1Pdsu4HZUsbxtfXs8d)

## Stack

Expo SDK 58 (React Native, TypeScript, Expo Router) · EAS Build (internal distribution) ·
EAS Update (OTA, fingerprint runtime) · Supabase free tier (Postgres + RLS, anonymous auth,
Storage, Realtime) · Expo Push · Open-Meteo · Apple Maps.

## Layout

```
index.ts                     entry: defines background tasks, then loads the router
src/app/                     screens (Expo Router): index (gate), welcome, pair, permissions, home
src/lib/backgroundTasks.ts   background location + ~1 km geofence safety net
src/lib/points.ts            500 m / 20 min filter, battery, place name, heartbeat
src/lib/queue.ts             offline queue (removed only after the server accepts)
src/lib/push.ts              Expo push, sent straight from the phone
src/lib/geo.ts               bearing, distance, smoothing (unit-tested)
supabase/migrations/         schema + RLS (applied by the db workflow)
supabase/tests/              RLS attack tests on an in-memory Postgres
.github/workflows/           checks, OTA update, db migrations, weekly encrypted backup
```

## Commands

```
npm run typecheck
npm test            # geometry + formatting
npm run test:rls    # security tests for the database
npx eslint .
```

## What ships how

| Change | How it reaches the phones |
|---|---|
| JS / screens / logic | push to `main` → OTA to `preview`; run "OTA update" with `production` for her phone |
| Database | new file in `supabase/migrations/` → db workflow (after RLS tests) |
| Native (modules, permissions, sounds, app.json) | new EAS build + install link |

## Secrets (GitHub → Settings → Secrets and variables → Actions)

| Secret | Used by |
|---|---|
| `EXPO_TOKEN` | OTA update |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` | db migrations |
| `BACKUP_DB_URL`, `BACKUP_PASSPHRASE` | weekly backup |

Never commit the Supabase `service_role` key.
