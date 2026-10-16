-- Teacher credentials for manual review (owner's list, adapted to college teaching):
-- degree certificate required; staff ID, UGC-NET/SET, B.Ed/D.El.Ed and CTET/TET optional;
-- institution code (AISHE for colleges, UDISE+ for schools) optional. Server-only table.
create table internal.teacher_documents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('degree', 'staff_id', 'net_set', 'bed', 'tet', 'other')),
  path text not null unique check (path ~ '^[0-9a-f-]{36}/teacher/[0-9a-f]{32}\.(pdf|jpg|jpeg|png)$'),
  unique (user_id, kind)
);
create index teacher_documents_user_idx on internal.teacher_documents (user_id);
alter table internal.teacher_documents enable row level security;
revoke all on internal.teacher_documents from public, anon, authenticated;
grant select, insert, update, delete on internal.teacher_documents to service_role;

-- Earlier single uploads become the degree certificate.
insert into internal.teacher_documents (user_id, kind, path)
select user_id, 'degree', document_path from public.teachers where document_path is not null
on conflict do nothing;

alter table public.teachers
  add column institution_code text not null default '' check (institution_code ~ '^([A-Za-z0-9-]{4,20})?$');
