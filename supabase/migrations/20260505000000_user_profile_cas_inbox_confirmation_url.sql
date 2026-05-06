-- Phase 6 / M2.4 — Gmail auto-forward verification capture.
--
-- When a user adds their `cas-<token>@foliolens.in` (prod) or
-- `cas-dev-<token>@foliolens.in` (dev) address as a "Forward to"
-- destination in Gmail, Google emails a confirmation URL to that
-- address (from forwarding-noreply@google.com). The
-- `cas-webhook-resend` Edge Function detects the verification email
-- and stores the URL on this column so the FolioLens UI can surface a
-- "Confirm Gmail forwarding" button to the user. Clicking the button
-- in Gmail's UI is what activates the auto-forward filter.
--
-- The column is cleared opportunistically by the Edge Function when
-- the next real CAS import succeeds (proving the filter is active),
-- because there's no other way to know the user actually clicked the
-- link — Google does not echo a confirmation back to us.
--
-- Nullable; populated only for Gmail users who opt into the
-- auto-forward path. Outlook + Microsoft 365 users skip verification
-- entirely. iCloud + Yahoo cannot use auto-forward at all.

alter table public.user_profile
  add column if not exists cas_inbox_confirmation_url text;

comment on column public.user_profile.cas_inbox_confirmation_url is
  'Gmail forwarding-confirmation URL captured from forwarding-noreply@google.com. Cleared on next successful CAS import.';
