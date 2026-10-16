-- Signed-in requests are parsed, scheduled and answered on the server (BUILD_PLAN B2/B3).
--
-- POST /api/v1/sessions/{id}/messages writes both the student's message and the reply, and it is
-- the only thing that creates plans. Taking INSERT away from clients means a tampered browser can
-- no longer invent assistant replies, fake `served_from` numbers, or store a plan the scheduler
-- never produced. Revoking a table privilege also revokes the column privileges granted earlier.
--
-- Kept for clients: reading their own rows, ticking/replanning their own plan (UPDATE of plan,
-- updated_at) and their checkpoints (done_at). Demo mode never writes to the database.

drop policy if exists "owner_insert" on public.messages;
revoke insert on public.messages from authenticated;

drop policy if exists "owner_insert" on public.study_plans;
drop policy if exists "owner_delete" on public.study_plans;
revoke insert, delete on public.study_plans from authenticated;
