-- F3: deleting a student's login removes every row they own (the API deletes their files first).
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000dd', 'del@test.local');
insert into public.profiles (id, username, consent_at) values ('00000000-0000-0000-0000-0000000000dd', 'to.delete', now());
insert into public.study_sessions (id, user_id, title) values ('10000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-0000000000dd', 'x');
insert into public.messages (session_id, user_id, role, content) values ('10000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-0000000000dd', 'user', 'hi');
insert into public.files (id, session_id, user_id, storage_path, original_name, display_name, mime, size_bytes) values ('20000000-0000-0000-0000-0000000000dd', '10000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-0000000000dd', 'dd/x/f/a.pdf', 'a.pdf', 'a.pdf', 'application/pdf', 1);
insert into public.file_chunks (file_id, session_id, user_id, idx, content) values ('20000000-0000-0000-0000-0000000000dd', '10000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-0000000000dd', 0, 'x');
insert into public.study_plans (id, session_id, user_id, subject, deadline_at, mode, language, style, plan, cache_key) values ('30000000-0000-0000-0000-0000000000dd', '10000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-0000000000dd', 'J', now(), 'crash', 'en', 'short', '{}', 'k');
insert into public.plan_checkpoints (plan_id, user_id, ord, title) values ('30000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-0000000000dd', 1, 't');
insert into public.generated_content (id, user_id, session_id, topic, kind, language, payload, cache_key) values ('50000000-0000-0000-0000-0000000000dd', '00000000-0000-0000-0000-0000000000dd', '10000000-0000-0000-0000-0000000000dd', 't', 'quiz', 'en', '{}', 'k');
insert into internal.quiz_keys (content_id, answers, why, topics) values ('50000000-0000-0000-0000-0000000000dd', '{1}', '{w}', '{t}');
insert into public.quiz_attempts (user_id, content_id, answers, score, total) values ('00000000-0000-0000-0000-0000000000dd', '50000000-0000-0000-0000-0000000000dd', '{}', 0, 1);
insert into public.flashcard_reviews (user_id, content_id, card_idx) values ('00000000-0000-0000-0000-0000000000dd', '50000000-0000-0000-0000-0000000000dd', 0);

delete from auth.users where id = '00000000-0000-0000-0000-0000000000dd';

select is(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000dd')
  + (select count(*) from public.study_sessions where user_id = '00000000-0000-0000-0000-0000000000dd')
  + (select count(*) from public.messages where user_id = '00000000-0000-0000-0000-0000000000dd')
  + (select count(*) from public.files where user_id = '00000000-0000-0000-0000-0000000000dd')
  + (select count(*) from public.file_chunks where user_id = '00000000-0000-0000-0000-0000000000dd')
  + (select count(*) from public.study_plans where user_id = '00000000-0000-0000-0000-0000000000dd')
  + (select count(*) from public.plan_checkpoints where user_id = '00000000-0000-0000-0000-0000000000dd')
  + (select count(*) from public.generated_content where user_id = '00000000-0000-0000-0000-0000000000dd')
  + (select count(*) from internal.quiz_keys where content_id = '50000000-0000-0000-0000-0000000000dd')
  + (select count(*) from public.quiz_attempts where user_id = '00000000-0000-0000-0000-0000000000dd')
  + (select count(*) from public.flashcard_reviews where user_id = '00000000-0000-0000-0000-0000000000dd'),
  0::bigint,
  'a deleted account leaves zero rows in all 11 tables');

select * from finish();
rollback;
