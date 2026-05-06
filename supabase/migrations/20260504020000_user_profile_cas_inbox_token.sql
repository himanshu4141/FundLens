-- Each user gets a stable, opaque inbox token. Resend Inbound routes any
-- email addressed to `cas-<token>@foliolens.in` (prod) or
-- `cas-dev-<token>@foliolens.in` (dev) at the cas-webhook-resend Edge
-- Function, which uses this column to identify the owner.
--
-- The token is intentionally short (8 base32 chars), without ambiguous
-- characters (0/O/1/I/L), so it's safe to render in copy-button UI and
-- legible when typed by hand.

create extension if not exists pgcrypto;

-- Generator: 8 random characters drawn from a 30-char unambiguous alphabet
create or replace function public.gen_cas_inbox_token()
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  alpha_len int := length(alphabet);
  token text := '';
  i int;
begin
  for i in 1..8 loop
    token := token || substr(alphabet, 1 + (floor(random() * alpha_len))::int, 1);
  end loop;
  return token;
end;
$$;

alter table public.user_profile
  add column if not exists cas_inbox_token text;

-- Backfill rows that were created before this migration. Use a loop so each
-- row gets an independent token; a single set-statement would call the
-- volatile function once and overwrite every row with the same value.
do $$
declare
  candidate text;
  rec record;
begin
  for rec in
    select user_id from public.user_profile where cas_inbox_token is null
  loop
    -- Retry until we find a token that doesn't collide with an existing one.
    loop
      candidate := public.gen_cas_inbox_token();
      exit when not exists (
        select 1 from public.user_profile where cas_inbox_token = candidate
      );
    end loop;
    update public.user_profile
       set cas_inbox_token = candidate
     where user_id = rec.user_id;
  end loop;
end $$;

alter table public.user_profile
  alter column cas_inbox_token set not null;

-- Once every existing row has a value, enforce uniqueness.
create unique index if not exists user_profile_cas_inbox_token_key
  on public.user_profile (cas_inbox_token);

-- BEFORE INSERT trigger: fill in the token if the client doesn't provide one,
-- and retry on the (very unlikely) collision.
create or replace function public.fill_cas_inbox_token()
returns trigger
language plpgsql
as $$
declare
  candidate text;
begin
  if new.cas_inbox_token is null or length(new.cas_inbox_token) = 0 then
    loop
      candidate := public.gen_cas_inbox_token();
      exit when not exists (
        select 1 from public.user_profile where cas_inbox_token = candidate
      );
    end loop;
    new.cas_inbox_token := candidate;
  end if;
  return new;
end;
$$;

drop trigger if exists user_profile_fill_cas_inbox_token on public.user_profile;
create trigger user_profile_fill_cas_inbox_token
  before insert on public.user_profile
  for each row
  execute function public.fill_cas_inbox_token();
