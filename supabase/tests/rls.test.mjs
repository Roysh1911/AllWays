// Runs the real migration against an in-memory Postgres with Supabase-like
// stubs, then attacks it as a third user. Usage: node rls.test.mjs <migration.sql>
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const migration = process.argv.slice(2).map((f) => readFileSync(f, 'utf8')).join('\n');
const db = new PGlite();

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;

  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id bigserial primary key, bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to anon, authenticated;
  grant all on storage.objects to authenticated;
  grant usage, select on all sequences in schema storage to authenticated;

  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  insert into auth.users values ('${A}'), ('${B}'), ('${C}');
`);

let publicationSupported = true;
try {
  await db.exec('create publication supabase_realtime;');
} catch {
  publicationSupported = false;
}
await db.exec(publicationSupported ? migration : migration.replace(/alter publication[^;]+;/i, ''));

let failures = 0;
const results = [];
async function as(uid, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try {
    return { rows: (await db.query(sql, params)).rows };
  } catch (e) {
    return { error: e.message };
  } finally {
    await db.exec('reset role;');
  }
}
function expect(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + detail}`);
  if (!ok) failures++;
}

// --- setup: A and B pair, C is a stranger ---
for (const [u, n] of [[A, 'Roy'], [B, 'Noa'], [C, 'Eve']]) {
  const r = await as(u, `insert into public.profiles (id, name) values ($1, $2)`, [u, n]);
  expect(`${n} creates own profile`, !r.error, r.error);
}
const code = (await as(A, `select public.create_pair_code() as c`)).rows[0].c;
expect('pair code is 6 digits', /^\d{6}$/.test(code), code);
const join = await as(B, `select public.join_pair($1) as p`, [code]);
expect('B joins with code', !join.error && join.rows[0].p === A, JSON.stringify(join));
const reuse = await as(C, `select public.join_pair($1)`, [code]);
expect('C cannot reuse the consumed code', !!reuse.error, 'no error');

// --- profiles ---
let r = await as(C, `insert into public.profiles (id, name) values ($1, 'fake')`, [A]);
expect('C cannot create a profile for A', !!r.error, 'inserted');
r = await as(C, `select id from public.profiles`);
expect('C sees only own profile', r.rows?.length === 1 && r.rows[0].id === C, JSON.stringify(r));
r = await as(B, `select id from public.profiles order by name`);
expect('B sees self and partner', r.rows?.length === 2, JSON.stringify(r));
r = await as(A, `update public.profiles set partner_id = $1 where id = $2`, [C, A]);
expect('A cannot rewrite partner_id directly', !!r.error, 'updated');
r = await as(C, `update public.profiles set name = 'hacked' where id = $1 returning id`, [A]);
expect("C cannot rename A", !r.error ? r.rows.length === 0 : true, JSON.stringify(r));
r = await as(A, `update public.profiles set sharing_paused = true where id = $1 returning id`, [A]);
expect('A can pause own sharing', r.rows?.length === 1, JSON.stringify(r));

// --- C tries to pair with A ---
const cCode = (await as(C, `select public.create_pair_code() as c`)).rows[0].c;
r = await as(A, `select public.join_pair($1)`, [cCode]);
expect('A (already paired) cannot join C', !!r.error && r.error.includes('already_paired'), JSON.stringify(r));

// --- locations ---
r = await as(A, `insert into public.locations (user_id, ts, lat, lng) values ($1, now(), 27.7, 85.3)`, [A]);
expect('A stores own point', !r.error, r.error);
r = await as(A, `insert into public.locations (user_id, ts, lat, lng) values ($1, (select max(ts) from public.locations), 27.7, 85.3) on conflict (user_id, ts) do nothing`, [A]);
expect('duplicate point is ignored', !r.error, r.error);
r = await as(B, `select lat from public.locations where user_id = $1`, [A]);
expect("B reads A's point", r.rows?.length === 1, JSON.stringify(r));
r = await as(C, `select lat from public.locations`);
expect("C reads nobody's points", r.rows?.length === 0, JSON.stringify(r));
r = await as(C, `insert into public.locations (user_id, ts, lat, lng) values ($1, now(), 0, 0)`, [A]);
expect('C cannot forge a point for A', !!r.error, 'inserted');
r = await as(B, `delete from public.locations where user_id = $1 returning id`, [A]);
expect("B cannot delete A's trail", (r.rows?.length ?? 0) === 0, JSON.stringify(r));

// --- pings ---
r = await as(B, `insert into public.pings (from_id, to_id) values ($1, $2)`, [B, A]);
expect('B pings A', !r.error, r.error);
r = await as(C, `insert into public.pings (from_id, to_id) values ($1, $2)`, [C, A]);
expect('C cannot ping A', !!r.error, 'inserted');
r = await as(C, `insert into public.pings (from_id, to_id) values ($1, $2)`, [A, B]);
expect('C cannot ping as A', !!r.error, 'inserted');
r = await as(C, `select * from public.pings`);
expect("C sees no pings", r.rows?.length === 0, JSON.stringify(r));

// --- pair_codes table is closed ---
r = await as(C, `select * from public.pair_codes`);
expect('pair codes are not readable', (r.rows?.length ?? 0) === 0, JSON.stringify(r));

// --- storage ---
r = await as(A, `insert into storage.objects (bucket_id, name) values ('statuses', $1)`, [`${A}/1.jpg`]);
expect('A uploads to own folder', !r.error, r.error);
r = await as(C, `insert into storage.objects (bucket_id, name) values ('statuses', $1)`, [`${A}/evil.jpg`]);
expect("C cannot upload into A's folder", !!r.error, 'inserted');
r = await as(B, `select name from storage.objects`);
expect("B sees A's photo", r.rows?.length === 1, JSON.stringify(r));
r = await as(C, `select name from storage.objects`);
expect("C sees no photos", r.rows?.length === 0, JSON.stringify(r));

// --- backup role: read-only ---
await db.exec(`set role backup_reader;`);
try {
  const n = (await db.query(`select count(*)::int as n from public.locations`)).rows[0].n;
  expect('backup role reads all points', n === 1, String(n));
} catch (e) {
  expect('backup role reads all points', false, e.message);
}
try {
  await db.query(`delete from public.locations`);
  expect('backup role cannot delete', false, 'deleted');
} catch {
  expect('backup role cannot delete', true);
}
await db.exec('reset role;');

console.log(results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} passed${publicationSupported ? '' : ' (publication line skipped: unsupported here)'}`);
process.exit(failures ? 1 : 0);
