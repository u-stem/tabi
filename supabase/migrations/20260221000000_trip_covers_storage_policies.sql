-- Storage bucket and RLS policies for trip-covers
-- Uploads/deletes are handled server-side via service_role key

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('trip-covers', 'trip-covers', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public can read trip-covers"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'trip-covers');
