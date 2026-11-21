-- The app creates its profile with an upsert (INSERT ... ON CONFLICT DO UPDATE),
-- and PostgREST includes "id" in the UPDATE SET list. Postgres requires the
-- UPDATE privilege on every column in that list, even when no conflict occurs.
-- Granting update(id) is safe: the "profiles: update own" policy checks
-- id = auth.uid() both before and after, so id can only be "changed" to itself.
grant update (id) on public.profiles to authenticated;
