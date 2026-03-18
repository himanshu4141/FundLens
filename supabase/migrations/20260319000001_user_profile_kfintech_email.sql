-- Store user's KFintech-registered email so we never ask again after first setup.
-- Nullable: users who haven't completed onboarding step 3 won't have this set.
alter table user_profile add column if not exists kfintech_email text;
