-- v0.5 live classes (ROADMAP.md): teachers, classes, interest queue, attendance, warnings, payouts.
--
-- Every write goes through the API, which applies the rules (verified teacher only, 10-40 seats,
-- first-interested-first-served, grace period, no-show warnings). Clients can only read, and only
-- what they need: the Jitsi room name is in `internal`, handed out by the API at join time, so
-- nobody can walk into a class they weren't seated in. No payments in the prototype: payouts are
-- recorded as "to_be_paid" (owner decision, MEMORY.md 2026-10-16).

-- A teacher is a profile with a verified status. Status is set only by the team (service role),
-- never by the user (DATABASE.md §6: roles never in user-editable places).
create table public.teachers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text not null check (char_length(display_name) between 2 and 60),
  bio text not null default '' check (char_length(bio) <= 600),
  subjects text[] not null default '{}' check (cardinality(subjects) <= 8),
  status text not null default 'pending' check (status in ('pending', 'verified', 'suspended')),
  verified_at timestamptz
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  subject text not null check (char_length(subject) between 2 and 120),
  topic text not null check (char_length(topic) between 2 and 160),
  level text not null default 'all' check (level in ('beginner', 'exam_prep', 'all')),
  starts_at timestamptz not null,
  duration_min smallint not null check (duration_min between 30 and 120),
  min_students smallint not null default 10 check (min_students = 10),
  max_students smallint not null default 40 check (max_students = 40),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'done')),
  cancel_reason text check (char_length(cancel_reason) <= 200),
  teacher_joined_at timestamptz
);
create index classes_starts_idx on public.classes (starts_at);
create index classes_teacher_idx on public.classes (teacher_id);

create table public.class_signups (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(), -- the queue order: first interested, first seated
  primary key (class_id, user_id)
);
create index class_signups_user_idx on public.class_signups (user_id);

create table public.class_attendance (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  role text not null check (role in ('teacher', 'student')),
  primary key (class_id, user_id)
);
create index class_attendance_user_idx on public.class_attendance (user_id);

-- Never client-readable.
create table internal.class_rooms (
  class_id uuid primary key references public.classes (id) on delete cascade,
  room text not null unique check (room ~ '^vl-[0-9a-f]{32}$')
);
create table internal.moderation_warnings (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  reason text not null check (char_length(reason) <= 200)
);
create index moderation_warnings_user_idx on internal.moderation_warnings (user_id);
create table internal.teacher_payouts (
  class_id uuid primary key references public.classes (id) on delete cascade,
  teacher_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  gross_paise integer not null check (gross_paise >= 0),
  fee_paise integer not null check (fee_paise >= 0),
  net_paise integer not null check (net_paise >= 0),
  students smallint not null,
  status text not null default 'to_be_paid' check (status in ('to_be_paid', 'paid'))
);
create index teacher_payouts_teacher_idx on internal.teacher_payouts (teacher_id);

alter table internal.class_rooms enable row level security;
alter table internal.moderation_warnings enable row level security;
alter table internal.teacher_payouts enable row level security;
revoke all on internal.class_rooms, internal.moderation_warnings, internal.teacher_payouts from public, anon, authenticated;
grant select, insert, update, delete on internal.class_rooms, internal.moderation_warnings, internal.teacher_payouts to service_role;

-- Public tables: RLS on, read-only for clients, every write through the API.
alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.class_signups enable row level security;
alter table public.class_attendance enable row level security;
grant select on public.teachers, public.classes, public.class_signups, public.class_attendance to authenticated;
grant select, insert, update, delete on public.teachers, public.classes, public.class_signups, public.class_attendance to service_role;

create policy "verified_or_self" on public.teachers for select to authenticated
  using (status = 'verified' or user_id = (select auth.uid()));
create policy "signed_in_read" on public.classes for select to authenticated using (true);
create policy "own_signups" on public.class_signups for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own_attendance" on public.class_attendance for select to authenticated
  using (user_id = (select auth.uid()));
