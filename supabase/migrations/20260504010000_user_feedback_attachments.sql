-- Allow users to attach a single screenshot/image to a feedback entry.
-- Path scheme: ${user_id}/${uuid}.${ext} so storage RLS can match the
-- folder against auth.uid() to enforce per-user isolation.

alter table public.user_feedback
  add column if not exists attachment_path text;

-- Create the dedicated storage bucket (private; users only see their own).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-feedback-attachments',
  'user-feedback-attachments',
  false,
  10485760,  -- 10 MB cap per attachment
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
)
on conflict (id) do nothing;

-- Users can upload to their own folder only (folder = user_id::text).
drop policy if exists user_feedback_attachments_insert_own on storage.objects;
create policy user_feedback_attachments_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'user-feedback-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their own attachments. Admins use service-role.
drop policy if exists user_feedback_attachments_select_own on storage.objects;
create policy user_feedback_attachments_select_own
  on storage.objects for select
  using (
    bucket_id = 'user-feedback-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
