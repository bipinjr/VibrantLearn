-- Uploads must go through the server, never straight from the browser.
--
-- The initial schema gave `authenticated` an INSERT policy on their own storage folder. That let a
-- signed-in student (or anything holding their token) put any file of any type into the bucket
-- without the checks SECURITY.md §8 requires: extension allowlist, declared size, per-user daily
-- quota, magic-byte verification, SHA-256, and a matching row in public.files.
--
-- The upload path is: client asks the API for a signed upload URL -> API validates the declared
-- name/type/size, enforces the quota and creates the files row -> client PUTs to that one-time URL.
-- A signed upload URL carries its own authorisation, so no client INSERT policy is needed.
--
-- SELECT stays (students read their own files through short-lived signed download URLs) and DELETE
-- stays (a student may remove their own file; session/account deletion still runs server-side so
-- the database rows and the objects go together).

drop policy if exists "own_folder_insert" on storage.objects;

comment on table storage.objects is
  'VibrantLearn: clients may read and delete only their own {user_id}/... objects. Writes happen '
  'through server-issued signed upload URLs after validation (SECURITY.md §8).';
