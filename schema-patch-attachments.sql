-- =========================================================================
-- PATCH: proof-of-billing/payment attachments (PDF/image)
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to run even if you already ran the original schema.
-- =========================================================================

-- 1. New optional columns to store the attachment's storage path
alter table invoices  add column if not exists attachment_url text;
alter table purchases add column if not exists attachment_url text;
alter table payments  add column if not exists attachment_url text;
alter table expenses  add column if not exists attachment_url text;

-- 2. Private storage bucket for uploaded proof files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set file_size_limit = 10485760, allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp','image/heic'];

-- 3. Storage RLS — files are stored under a path like "<company_id>/<filename>",
-- so each company can only touch its own folder. Uses the same my_company()
-- helper defined in the main schema.
drop policy if exists "company members upload attachments" on storage.objects;
create policy "company members upload attachments" on storage.objects
  for insert with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = my_company()::text);

drop policy if exists "company members read attachments" on storage.objects;
create policy "company members read attachments" on storage.objects
  for select using (bucket_id = 'attachments' and (storage.foldername(name))[1] = my_company()::text);

drop policy if exists "company members delete attachments" on storage.objects;
create policy "company members delete attachments" on storage.objects
  for delete using (bucket_id = 'attachments' and (storage.foldername(name))[1] = my_company()::text);
