-- TEACHER.md T3-T10 and student rewards. Everything new is server-only (internal) unless noted.

-- T3: classes attach to syllabus topics (1-4) and have a seat cap of 10-40.
alter table public.classes add column topic_ids uuid[] not null default '{}' check (cardinality(topic_ids) <= 4);
alter table public.classes drop constraint classes_max_students_check;
alter table public.classes add constraint classes_max_students_check check (max_students between 10 and 40);
alter table public.classes add column repeat_of uuid references public.classes (id) on delete set null;

-- T5: questions in the class chat, answered by the teacher.
alter table internal.class_messages add column is_question boolean not null default false;
alter table internal.class_messages add column answered_at timestamptz;

-- T5/T9: reports about a person in a class, with an outcome the reporter can see.
create table internal.moderation_flags (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  class_id uuid references public.classes (id) on delete set null,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_id uuid references auth.users (id) on delete set null,
  message_id bigint references internal.class_messages (id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 300),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  outcome text check (char_length(outcome) <= 300)
);
create index moderation_flags_reporter_idx on internal.moderation_flags (reporter_id);
create index moderation_flags_reported_idx on internal.moderation_flags (reported_id);

-- T9: a real appeal path for every warning.
create table internal.appeals (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  warning_id bigint not null unique references internal.moderation_warnings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'upheld', 'removed')),
  outcome text check (char_length(outcome) <= 300)
);
create index appeals_user_idx on internal.appeals (user_id);

-- T10: notification preferences (no teacher column on profiles).
alter table public.teachers add column notify jsonb not null default '{"class_reminders": true, "demand_alerts": true}';

-- Rewards: students who chose to appear on the weekly leaderboard (by username only).
create table internal.reward_optin (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table internal.moderation_flags enable row level security;
alter table internal.appeals enable row level security;
alter table internal.reward_optin enable row level security;
revoke all on internal.moderation_flags, internal.appeals, internal.reward_optin from public, anon, authenticated;
grant select, insert, update, delete on internal.moderation_flags, internal.appeals, internal.reward_optin to service_role;
