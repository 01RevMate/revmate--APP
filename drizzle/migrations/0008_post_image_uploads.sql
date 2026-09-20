-- Storage bucket for post images. file_size_limit and allowed_mime_types are
-- enforced by Supabase Storage itself at upload time, not just client-side,
-- so a 20MB or non-image file is rejected by the server regardless of what
-- the browser tries to send.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images',
  true,
  5242880, -- 5MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Objects are stored under "<user_id>/<filename>" so ownership is checkable
-- from the path alone, the same way garage_mods checks ownership via a join.
CREATE POLICY "Post images are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-images');

CREATE POLICY "Users upload their own post images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete their own post images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Multiple images per post (up to 4, enforced client-side)
CREATE TABLE public.post_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX post_images_post_id_idx ON public.post_images(post_id);
GRANT SELECT ON public.post_images TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_images TO authenticated;
GRANT ALL ON public.post_images TO service_role;
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post images are viewable by everyone" ON public.post_images FOR SELECT USING (true);
CREATE POLICY "Users add images to own posts" ON public.post_images FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
);
CREATE POLICY "Users delete images from own posts" ON public.post_images FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
);
