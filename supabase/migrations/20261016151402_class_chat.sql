-- v0.5 class chat with the moderation bot (apps/api/app/services/class_chat.py).
-- Server-only: the API checks every message before anyone else sees it, so clients never read or
-- write this table directly. user_id null = a notice from the bot. Hidden messages keep their text
-- as evidence for review and are shown only to their author. Deleted with the account (cascade).
create table internal.class_messages (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  author text not null check (char_length(author) between 1 and 60),
  body text not null check (char_length(body) between 1 and 500),
  hidden_reason text check (hidden_reason in ('abuse', 'sexual', 'hate', 'threat', 'contact'))
);
create index class_messages_class_idx on internal.class_messages (class_id, id);
create index class_messages_user_idx on internal.class_messages (user_id);

alter table internal.class_messages enable row level security;
revoke all on internal.class_messages from public, anon, authenticated;
grant select, insert, update, delete on internal.class_messages to service_role;
