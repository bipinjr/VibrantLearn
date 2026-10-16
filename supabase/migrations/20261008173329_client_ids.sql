-- The app generates UUIDs for new sessions and messages so it can navigate instantly.
-- Still owner-checked by RLS; a duplicate id simply fails the primary key.
grant insert (id) on public.study_sessions to authenticated;
grant insert (id) on public.messages to authenticated;
