-- Interim (until the FastAPI service is deployed): signed-in students may write THEIR OWN profile,
-- messages and plans directly. Every write is owner-checked by RLS; a student can only ever touch
-- rows in their own sessions. AI content, files, chunks and internal.* stay server-only.
-- Decision logged in MEMORY.md (2026-10-08).

-- Reserved usernames enforced in the database too (third enforcement point, SECURITY.md §5).
alter table public.profiles add constraint profiles_username_not_reserved check (
  username is null or lower(replace(replace(username::text, '.', ''), '|', '')) <> all (array[
    'admin','administrator','support','help','vibrantlearn','vibrant','root','system','teacher',
    'teachers','moderator','mod','staff','official','security','api','app','null','undefined','me',
    'settings','login','signup','auth','onboarding'
  ])
);

-- profiles: create your own row (consent required), then edit it.
grant insert (id, username, full_name, university, course, semester, scheme, language, style, formats, consent_at, onboarded_at)
  on public.profiles to authenticated;
grant update (username, consent_at, onboarded_at) on public.profiles to authenticated;
create policy "owner_insert" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id and consent_at is not null);

-- study_sessions: owners may delete their own sessions (no stored files yet in this phase).
grant delete on public.study_sessions to authenticated;
create policy "owner_delete" on public.study_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- messages: append to your own sessions only.
alter table public.messages alter column user_id set default auth.uid();
grant insert (session_id, role, content, blocks, intent, served_from) on public.messages to authenticated;
create policy "owner_insert" on public.messages
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.study_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );

-- study_plans: create, tick/replan (plan jsonb) and replace plans in your own sessions.
alter table public.study_plans alter column user_id set default auth.uid();
grant insert (id, session_id, subject, deadline_at, mode, hours_available, language, style, formats, plan, cache_key)
  on public.study_plans to authenticated;
grant update (plan, updated_at) on public.study_plans to authenticated;
grant delete on public.study_plans to authenticated;
create policy "owner_insert" on public.study_plans
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.study_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );
create policy "owner_update" on public.study_plans
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "owner_delete" on public.study_plans
  for delete to authenticated using ((select auth.uid()) = user_id);
