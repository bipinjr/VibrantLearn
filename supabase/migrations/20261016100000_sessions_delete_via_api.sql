-- Session delete moves to the API (BUILD_PLAN A3).
--
-- Uploads are real now, so a session can own objects in Storage under {user_id}/{session_id}/.
-- A client-side DELETE would remove the row (and, by cascade, the files rows) but leave those
-- objects orphaned. The API deletes the objects first, verifies none remain, then the row.

drop policy if exists "owner_delete" on public.study_sessions;
revoke delete on public.study_sessions from authenticated;
