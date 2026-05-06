-- Phase 6 / M2.4 follow-up — user-confirmed auto-forward setup state.
--
-- Gmail verification proves the destination address was confirmed, but the
-- app still needs a durable user-controlled "I finished the advanced setup"
-- state after they create the Gmail filter. This timestamp is set from the
-- onboarding / Settings checklist and lets the UI say future CAMS/KFintech
-- CAS emails should auto-forward.

alter table public.user_profile
  add column if not exists cas_auto_forward_setup_completed_at timestamptz;

comment on column public.user_profile.cas_auto_forward_setup_completed_at is
  'Set when the user confirms they completed email-provider auto-forward setup for their FolioLens CAS inbox.';
