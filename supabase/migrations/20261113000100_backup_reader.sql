-- Read-only role for the weekly encrypted backup (GitHub Action).
-- Created without login. To activate it, run once in the Supabase SQL editor,
-- with a long random password that you then store as a GitHub secret:
--   alter role backup_reader with login password '<long random password>';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'backup_reader') then
    create role backup_reader nologin;
  end if;
end
$$;

grant usage on schema public to backup_reader;
grant select on public.profiles, public.locations, public.pings, public.statuses to backup_reader;

-- RLS is on for every table, so the role needs explicit read-only policies.
create policy "backup: read all" on public.profiles  for select to backup_reader using (true);
create policy "backup: read all" on public.locations for select to backup_reader using (true);
create policy "backup: read all" on public.pings     for select to backup_reader using (true);
create policy "backup: read all" on public.statuses  for select to backup_reader using (true);
