-- Second bucket for non-post images (avatars, cover photos, car photos) —
-- same server-enforced size/type limits as post-images, kept separate so
-- post moderation/cleanup never has to reason about profile media too.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-media',
  'user-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "User media is publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-media');

CREATE POLICY "Users upload their own media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete their own media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);
