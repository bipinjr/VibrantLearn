-- TEACHER.md T1: onboarding details, document for manual review, payout details, reviewers.
-- Identity stays in public.teachers keyed by the auth user (no teacher column on profiles), and
-- status is written only by the service role, so a teacher account can later also be a student.

alter table public.teachers drop constraint teachers_status_check;
alter table public.teachers add constraint teachers_status_check
  check (status in ('pending', 'verified', 'rejected', 'suspended'));
alter table public.teachers
  add column organisation text not null default '' check (char_length(organisation) <= 120),
  add column consent_at timestamptz,
  add column document_path text check (document_path ~ '^[0-9a-f-]{36}/teacher/[0-9a-f]{32}\.(pdf|jpg|jpeg|png)$'),
  add column submitted_at timestamptz,
  add column reviewed_at timestamptz,
  add column review_note text check (char_length(review_note) <= 300);

-- Payout details are never client-readable: the API returns them masked.
create table internal.teacher_payout_details (
  user_id uuid primary key references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now(),
  method text not null check (method in ('upi', 'bank')),
  upi_id text check (upi_id ~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$'),
  account_name text check (char_length(account_name) between 2 and 80),
  account_number text check (account_number ~ '^[0-9]{9,18}$'),
  ifsc text check (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  check ((method = 'upi' and upi_id is not null)
      or (method = 'bank' and account_name is not null and account_number is not null and ifsc is not null))
);

-- The team members who review teachers (TEACHER.md T1: manual verification). Added by SQL only.
create table internal.reviewers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table internal.teacher_payout_details enable row level security;
alter table internal.reviewers enable row level security;
revoke all on internal.teacher_payout_details, internal.reviewers from public, anon, authenticated;
grant select, insert, update, delete on internal.teacher_payout_details, internal.reviewers to service_role;
