insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'announcement-photos',
  'announcement-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view announcement photos" on storage.objects;
create policy "Public can view announcement photos"
  on storage.objects
  for select
  to public
  using (bucket_id = 'announcement-photos');

drop policy if exists "Staff can upload announcement photos" on storage.objects;
create policy "Staff can upload announcement photos"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'announcement-photos');

drop policy if exists "Staff can update announcement photos" on storage.objects;
create policy "Staff can update announcement photos"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'announcement-photos')
  with check (bucket_id = 'announcement-photos');

drop policy if exists "Staff can delete announcement photos" on storage.objects;
create policy "Staff can delete announcement photos"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'announcement-photos');
