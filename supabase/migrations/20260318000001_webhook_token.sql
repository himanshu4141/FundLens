-- Per-user webhook token for CAS import via CASParser.in
-- Each user gets a unique UUID token used in their webhook URL:
--   https://<project>.supabase.co/functions/v1/cas-webhook?token=<uuid>

create table webhook_token (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique(user_id),
  unique(token)
);

alter table webhook_token enable row level security;

create policy "Users can view and manage their own webhook token"
  on webhook_token for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast token lookup in the Edge Function (no auth context)
create index idx_webhook_token_token on webhook_token(token);
