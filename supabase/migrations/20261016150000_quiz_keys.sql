-- Quiz answer keys live where students can't read them (BUILD_PLAN D3).
--
-- generated_content is owner-readable, so a quiz's correct answers can't sit in its payload: a
-- student could read them straight from the Data API and then "score" 5/5. The API stores the
-- questions in generated_content and the key here; it grades every answer itself and keeps only
-- the first answer to each question in quiz_attempts.

create table internal.quiz_keys (
  content_id uuid primary key references public.generated_content (id) on delete cascade,
  created_at timestamptz not null default now(),
  answers smallint[] not null,
  why text[] not null,
  topics text[] not null
);
alter table internal.quiz_keys enable row level security;
revoke all on internal.quiz_keys from public, anon, authenticated;
grant select, insert, update, delete on internal.quiz_keys to service_role;
