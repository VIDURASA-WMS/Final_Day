-- ============================================================
-- Run this AFTER you've created the "post-images" bucket in
-- Storage (dashboard). See the guide, Step 5.
-- ============================================================

create policy "public read post images"
on storage.objects for select
using ( bucket_id = 'post-images' );

create policy "anyone can upload post images"
on storage.objects for insert
with check ( bucket_id = 'post-images' );

create policy "admin can delete post images"
on storage.objects for delete
using ( bucket_id = 'post-images' and auth.role() = 'authenticated' );
