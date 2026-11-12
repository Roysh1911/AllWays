-- The Compass app: initial schema.
-- Every table is protected by Row Level Security: a row is visible only to
-- its owner and to the owner's partner. The anon key in the app is public;
-- these policies are what keep the data private.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 40),
  partner_id       uuid references public.profiles (id) on delete set null,
  sharing_paused   boolean not null default false,
  expo_push_token  text,
  last_seen        timestamptz,
  created_at       timestamptz not null default now()
);

-- The partner of the signed-in user. SECURITY DEFINER so policies can call it
-- without recursing into the profiles policies.
create or replace function public.my_partner()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select partner_id from public.profiles where id = auth.uid();
$$;

revoke all on function public.my_partner() from public;
grant execute on function public.my_partner() to authenticated;

alter table public.profiles enable row level security;

create policy "profiles: read self and partner"
  on public.profiles for select to authenticated
  using (id = auth.uid() or id = public.my_partner());

create policy "profiles: create own, unpaired"
  on public.profiles for insert to authenticated
  with check (id = auth.uid() and partner_id is null);

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- partner_id can only change through the pairing functions below.
revoke update on public.profiles from authenticated, anon;
grant update (name, sharing_paused, expo_push_token, last_seen)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Pairing
-- ---------------------------------------------------------------------------
create table public.pair_codes (
  code        text primary key,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  expires_at  timestamptz not null default now() + interval '15 minutes'
);

alter table public.pair_codes enable row level security;
-- No policies: the table is reachable only through the functions below.

create or replace function public.create_pair_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and partner_id is null) then
    raise exception 'not_eligible';
  end if;

  delete from public.pair_codes where owner_id = auth.uid() or expires_at < now();

  loop
    new_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.pair_codes where code = new_code);
  end loop;

  insert into public.pair_codes (code, owner_id) values (new_code, auth.uid());
  return new_code;
end;
$$;

create or replace function public.join_pair(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  other uuid;
begin
  select owner_id into other
  from public.pair_codes
  where code = p_code and expires_at > now()
  for update;

  if other is null or other = auth.uid() then
    raise exception 'invalid_code';
  end if;

  if exists (
    select 1 from public.profiles
    where id in (auth.uid(), other) and partner_id is not null
  ) then
    raise exception 'already_paired';
  end if;

  update public.profiles set partner_id = other      where id = auth.uid();
  update public.profiles set partner_id = auth.uid() where id = other;
  delete from public.pair_codes where owner_id in (auth.uid(), other);
  return other;
end;
$$;

revoke all on function public.create_pair_code() from public;
revoke all on function public.join_pair(text) from public;
grant execute on function public.create_pair_code() to authenticated;
grant execute on function public.join_pair(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Locations (every stored point; the latest one drives the compass)
-- ---------------------------------------------------------------------------
create table public.locations (
  id       bigint generated always as identity primary key,
  user_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  ts       timestamptz not null,
  lat      double precision not null check (lat between -90 and 90),
  lng      double precision not null check (lng between -180 and 180),
  acc      real,
  battery  real check (battery between 0 and 1),
  place    text,
  source   text not null default 'track' check (source in ('track', 'fence', 'foreground'))
);

-- Unique per user and timestamp: a retried upload after a lost response is a no-op.
create unique index locations_user_ts on public.locations (user_id, ts desc);

alter table public.locations enable row level security;

create policy "locations: read self and partner"
  on public.locations for select to authenticated
  using (user_id = auth.uid() or user_id = public.my_partner());

create policy "locations: insert own"
  on public.locations for insert to authenticated
  with check (user_id = auth.uid());

create policy "locations: delete own"
  on public.locations for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Pings ("thinking of you")
-- ---------------------------------------------------------------------------
create table public.pings (
  id          bigint generated always as identity primary key,
  from_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  to_id       uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index pings_to_created on public.pings (to_id, created_at desc);
create index pings_from_created on public.pings (from_id, created_at desc);

alter table public.pings enable row level security;

create policy "pings: read own"
  on public.pings for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());

create policy "pings: send to partner"
  on public.pings for insert to authenticated
  with check (from_id = auth.uid() and to_id = public.my_partner());

-- ---------------------------------------------------------------------------
-- Statuses (text + optional photo). Screen ships later by OTA; table now.
-- ---------------------------------------------------------------------------
create table public.statuses (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  text        text check (char_length(text) <= 280),
  preset      text,
  photo_path  text,
  lat         double precision,
  lng         double precision
);

create index statuses_user_created on public.statuses (user_id, created_at desc);

alter table public.statuses enable row level security;

create policy "statuses: read self and partner"
  on public.statuses for select to authenticated
  using (user_id = auth.uid() or user_id = public.my_partner());

create policy "statuses: insert own"
  on public.statuses for insert to authenticated
  with check (user_id = auth.uid());

create policy "statuses: delete own"
  on public.statuses for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for status photos, folder per user
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('statuses', 'statuses', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "status photos: read self and partner"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'statuses'
    and (storage.foldername(name))[1] in (auth.uid()::text, public.my_partner()::text)
  );

create policy "status photos: upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'statuses'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "status photos: delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'statuses'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Realtime: the needle moves as soon as a new point arrives
-- (postgres_changes respects the RLS policies above)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.locations, public.pings, public.profiles, public.statuses;
