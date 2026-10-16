-- v0.5 teacher dashboard: class ratings and withdrawal requests.
-- Ratings: one per student per class, only from students who were seated (checked by the API).
-- Withdrawal: no payments in the prototype (MEMORY.md 2026-10-16), so "withdraw" moves earnings
-- from to_be_paid to requested; the team pays out by hand and marks them paid.
create table internal.class_ratings (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  stars smallint not null check (stars between 1 and 5),
  primary key (class_id, user_id)
);
create index class_ratings_user_idx on internal.class_ratings (user_id);
alter table internal.class_ratings enable row level security;
revoke all on internal.class_ratings from public, anon, authenticated;
grant select, insert, update, delete on internal.class_ratings to service_role;

alter table internal.teacher_payouts drop constraint teacher_payouts_status_check;
alter table internal.teacher_payouts add constraint teacher_payouts_status_check
  check (status in ('to_be_paid', 'requested', 'paid'));
alter table internal.teacher_payouts add column requested_at timestamptz;

-- Teacher setup questionnaire (asked once, at sign-up; editable later).
alter table public.teachers
  add column qualification text not null default '' check (char_length(qualification) <= 120),
  add column experience_years smallint not null default 0 check (experience_years between 0 and 60),
  add column languages text[] not null default '{en}'
    check (languages <@ array['en', 'kn', 'hi']::text[] and cardinality(languages) between 1 and 3),
  add column preferred_days text[] not null default '{}'
    check (preferred_days <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]),
  add column preferred_slots text[] not null default '{}'
    check (preferred_slots <@ array['5-6pm', '6-7pm', '7-8pm', '8-9pm', '9-10pm']::text[]),
  add column levels text[] not null default '{all}'
    check (levels <@ array['beginner', 'exam_prep', 'all']::text[]);
