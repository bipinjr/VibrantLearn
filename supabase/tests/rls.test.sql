-- RLS + grants: user A must never see or change user B's data; anon sees nothing private.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- ---- fixtures (as postgres) -----------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

insert into public.profiles (id, username) values
  ('00000000-0000-0000-0000-00000000000a', 'user.a'),
  ('00000000-0000-0000-0000-00000000000b', 'user.b');

insert into public.study_sessions (id, user_id, title) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A java'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'B dbms');

insert into public.messages (session_id, user_id, role, content)
select id, user_id, 'user', 'hello' from public.study_sessions;

insert into public.files (id, session_id, user_id, storage_path, original_name, display_name, mime, size_bytes)
select ('20000000-0000-0000-0000-00000000000' || right(id::text, 1))::uuid, id, user_id,
       user_id || '/' || id || '/f/notes.pdf', 'notes.pdf', 'notes.pdf', 'application/pdf', 100
from public.study_sessions;

insert into public.file_chunks (file_id, session_id, user_id, idx, content)
select id, session_id, user_id, 0, 'method overriding in java' from public.files;

insert into public.study_plans (id, session_id, user_id, subject, deadline_at, mode, language, style, plan, cache_key)
select ('30000000-0000-0000-0000-00000000000' || right(id::text, 1))::uuid, id, user_id,
       'Java Programming', now() + interval '1 day', 'crash', 'en', 'short', '{}', 'k'
from public.study_sessions;

insert into public.plan_checkpoints (id, plan_id, user_id, ord, title)
select ('40000000-0000-0000-0000-00000000000' || right(id::text, 1))::uuid, id, user_id, 1, 'Unit 3 done'
from public.study_plans;

insert into public.generated_content (id, user_id, session_id, topic, kind, language, payload, cache_key)
select ('50000000-0000-0000-0000-00000000000' || right(id::text, 1))::uuid, user_id, id,
       'Inheritance', 'quiz', 'en', '{}', 'k'
from public.study_sessions;

insert into public.quiz_attempts (user_id, content_id, answers, score, total)
select user_id, id, '[]', 1, 2 from public.generated_content;

insert into public.flashcard_reviews (user_id, content_id, card_idx)
select user_id, id, 0 from public.generated_content;

insert into storage.objects (bucket_id, name, owner_id) values
  ('user-files', '00000000-0000-0000-0000-00000000000a/s/f/a.pdf', '00000000-0000-0000-0000-00000000000a'),
  ('user-files', '00000000-0000-0000-0000-00000000000b/s/f/b.pdf', '00000000-0000-0000-0000-00000000000b');

-- ---- DB-level username rule (third enforcement point) ---------------------------------------
select throws_ok($$update public.profiles set username = 'ab' where username = 'user.a'$$, '23514',
  null, 'username shorter than 3 is rejected');
select throws_ok($$update public.profiles set username = '.abc' where username = 'user.a'$$, '23514',
  null, 'username starting with a dot is rejected');
select throws_ok($$update public.profiles set username = 'a<b>c' where username = 'user.a'$$, '23514',
  null, 'username with HTML characters is rejected');
select throws_ok($$update public.profiles set username = 'USER.B' where username = 'user.a'$$, '23505',
  null, 'usernames are unique case-insensitively');

-- ---- act as user A ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*) from public.profiles)::int, 1, 'A sees only own profile');
select is((select count(*) from public.study_sessions)::int, 1, 'A sees only own sessions');
select is((select count(*) from public.messages)::int, 1, 'A sees only own messages');
select is((select count(*) from public.files)::int, 1, 'A sees only own files');
select is((select count(*) from public.file_chunks)::int, 1, 'A sees only own chunks');
select is((select count(*) from public.study_plans)::int, 1, 'A sees only own plans');
select is((select count(*) from public.plan_checkpoints)::int, 1, 'A sees only own checkpoints');
select is((select count(*) from public.generated_content)::int, 1, 'A sees only own content');
select is((select count(*) from public.quiz_attempts)::int, 1, 'A sees only own quiz attempts');
select is((select count(*) from public.flashcard_reviews)::int, 1, 'A sees only own flashcard reviews');
select is((select count(*) from storage.objects where bucket_id = 'user-files')::int, 1,
  'A sees only objects in own storage folder');
select ok((select count(*) from public.syllabus_topics) > 0, 'signed-in users can read the syllabus');

-- writes A must not be able to do
select is_empty($$update public.study_sessions set title = 'hacked'
  where id = '10000000-0000-0000-0000-00000000000b' returning 1$$,
  'A cannot rename B''s session');
select throws_ok($$update public.study_sessions set user_id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'A cannot move a session to another user');
select throws_ok($$insert into public.messages (session_id, role, content)
  values ('10000000-0000-0000-0000-00000000000b', 'user', 'sneaky')$$,
  '42501', null, 'A cannot add a message to B''s session');
select lives_ok($$insert into public.messages (session_id, role, content)
  values ('10000000-0000-0000-0000-00000000000a', 'user', 'my question')$$,
  'A can add a message to own session');
select throws_ok($$insert into public.study_plans (session_id, subject, deadline_at, mode, language, style, plan, cache_key)
  values ('10000000-0000-0000-0000-00000000000b', 'x', now(), 'crash', 'en', 'short', '{}', 'k')$$,
  '42501', null, 'A cannot create a plan in B''s session');
select throws_ok($$update public.profiles set username = 'admin'$$, '23514', null,
  'reserved usernames are rejected by the database');
select throws_ok($$update public.plan_checkpoints set title = 'x'$$, '42501', null,
  'checkpoint title is not client-editable');
select is_empty($$delete from public.study_sessions
  where id = '10000000-0000-0000-0000-00000000000b' returning 1$$,
  'A cannot delete B''s session');
select throws_ok($$insert into public.flashcard_reviews (content_id, card_idx)
  values ('50000000-0000-0000-0000-00000000000b', 1)$$, '42501', null,
  'A cannot review cards from B''s content');
select throws_ok($$insert into public.study_sessions (title, user_id)
  values ('x', '00000000-0000-0000-0000-00000000000b')$$, '42501', null,
  'A cannot create a session owned by B');
select throws_ok($$select * from public.waitlist$$, '42501', null, 'waitlist is not client-readable');
select throws_ok($$select * from internal.rate_limits$$, '42501', null, 'internal schema is closed');
-- Hosted Supabase blocks all direct SQL deletes on storage (Storage API only).
select throws_ok($$delete from storage.objects where name like '00000000-0000-0000-0000-00000000000b/%'$$,
  '42501', null, 'stored files can only be deleted through the Storage API');
-- Uploads are server-validated: no client INSERT policy on storage (SECURITY.md §8).
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id)
  values ('user-files', '00000000-0000-0000-0000-00000000000a/s/f/sneaky.exe',
          '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'clients cannot upload straight to storage, even into their own folder');

-- writes A is allowed to do
select lives_ok($$update public.profiles set language = 'kn', formats = array['quiz']$$,
  'A can edit own preferences');
select lives_ok($$update public.plan_checkpoints set done_at = now()$$, 'A can tick own checkpoint');
select is((select count(*) from public.plan_checkpoints where done_at is not null)::int, 1,
  'tick landed on A''s checkpoint');
select lives_ok($$insert into public.study_sessions (title) values ('Python test')$$,
  'A can start a session');
select is((select count(*) from public.study_sessions)::int, 2, 'new session is owned by A');

-- ---- anon -----------------------------------------------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select * from public.study_sessions$$, '42501', null, 'anon cannot read sessions');
select throws_ok($$select * from public.syllabi$$, '42501', null, 'anon cannot read syllabus');

select * from finish();
rollback;
