-- User-submitted feedback (feature requests + bug reports) captured natively
-- from the in-app About screen. Avoids sending users to a Tally form on the
-- web — keeps them inside the app and lets us tag entries with the user_id,
-- app version, and OTA update id for triage.

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('feature_request', 'bug_report')),
  title text not null check (length(title) between 1 and 200),
  body text not null check (length(body) between 1 and 4000),
  app_version text,
  update_id text,
  status text not null default 'new' check (status in ('new', 'triaged', 'in_progress', 'resolved', 'wont_fix', 'duplicate')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_feedback_user_id_idx on public.user_feedback (user_id);
create index if not exists user_feedback_status_created_idx on public.user_feedback (status, created_at desc);

alter table public.user_feedback enable row level security;

-- Users can insert their own feedback.
create policy user_feedback_insert_own
  on public.user_feedback for insert
  with check (auth.uid() = user_id);

-- Users can read only their own past feedback.
create policy user_feedback_select_own
  on public.user_feedback for select
  using (auth.uid() = user_id);

-- No update or delete from clients; admins use the service role key.
