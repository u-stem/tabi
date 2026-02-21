-- Storage bucket and RLS policies for trip-covers
-- App uses Better Auth (not Supabase Auth), so anon role is needed for client-side uploads

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('trip-covers', 'trip-covers', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "anyone can upload to trip-covers"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'trip-covers');

CREATE POLICY "public can read trip-covers"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'trip-covers');

CREATE POLICY "anyone can delete from trip-covers"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'trip-covers');
