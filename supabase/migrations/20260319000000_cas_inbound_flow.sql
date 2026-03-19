-- User profile — stores PAN needed to decrypt CAS PDFs
create table user_profile (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  pan        text not null check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_profile enable row level security;

create policy "user_profile_owner"
  on user_profile
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger set_user_profile_updated_at
  before update on user_profile
  for each row execute function set_updated_at();

-- CASParser inbound email session — one active address per user (upsert replaces)
create table cas_inbound_session (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  inbound_email_id      text not null,
  inbound_email_address text not null,
  created_at            timestamptz not null default now()
);

alter table cas_inbound_session enable row level security;

create policy "cas_inbound_session_owner"
  on cas_inbound_session
  using (auth.uid() = user_id);

-- Webhook token table is no longer needed — user identity is carried via the
-- `reference` field that CASParser echoes back in every webhook payload.
drop table if exists webhook_token;
