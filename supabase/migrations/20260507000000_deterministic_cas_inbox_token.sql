-- Deterministic per-user inbox token.
--
-- Background: the original `gen_cas_inbox_token()` was random, and the BEFORE
-- INSERT trigger called it on every fresh row. That meant deleting and
-- recreating a `user_profile` row (e.g., during a dev test reset) handed the
-- user a *new* token — silently breaking any Gmail / Outlook auto-forward
-- filter they had pointed at the old `cas-<old-token>@foliolens.in` address.
-- The Vercel router still routes the email to the right Supabase project,
-- but the webhook returns `unknown_token` and the CAS PDF gets dropped.
--
-- Make the generator deterministic: the token is now `f(user_id)`, so a
-- recreated row gets back the same token and existing forwarding filters
-- keep working.
--
-- Why MD5 (not pgcrypto SHA-256): MD5 is built into Postgres core and avoids
-- the schema-qualification dance for `extensions.digest()`. Cryptographic
-- collision resistance is irrelevant here — the unique index on
-- `cas_inbox_token` is the security boundary, and our 30^8 ≈ 6.6e11 output
-- space gives a birthday-paradox collision threshold around 800k users,
-- well past anything we'll hit at FolioLens scale.
--
-- We deliberately do NOT backfill existing rows. Their tokens (random,
-- minted by the previous generator) are still valid and unique; rotating
-- them now would break any forwarding filters those users have already set
-- up. The new logic kicks in only for rows inserted after this migration.

create or replace function public.gen_cas_inbox_token(p_user_id uuid)
returns text
language plpgsql
immutable
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  alpha_len constant int := length(alphabet);
  h bytea;
  result text := '';
  i int;
begin
  -- 16-byte MD5 digest of the user_id; we use the first 8 bytes, mod-30
  -- each into the alphabet.
  h := decode(md5(p_user_id::text), 'hex');
  for i in 0..7 loop
    result := result || substr(alphabet, 1 + (get_byte(h, i) % alpha_len), 1);
  end loop;
  return result;
end;
$$;

-- Drop the no-arg random generator; the trigger now passes user_id explicitly.
drop function if exists public.gen_cas_inbox_token();

-- Update the trigger function to use the deterministic generator.
create or replace function public.fill_cas_inbox_token()
returns trigger
language plpgsql
as $$
begin
  if new.cas_inbox_token is null or length(new.cas_inbox_token) = 0 then
    new.cas_inbox_token := public.gen_cas_inbox_token(new.user_id);
  end if;
  return new;
end;
$$;
