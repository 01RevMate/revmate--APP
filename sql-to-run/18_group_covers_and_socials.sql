-- RevMate SQL step 18 — group cover images + YouTube, Snapchat and X profile links.
-- Copy of drizzle/migrations/0052_group_covers_and_socials.sql. Safe to run more than once.

-- Group cover images, and more social links on profiles (YouTube,
-- Snapchat, X). Run after 0051. Additive only — nothing is deleted.

BEGIN;

-- Group owners and admins can set a cover image (group_edit policy already
-- limits updates to them).
ALTER TABLE public.community_groups
  ADD COLUMN IF NOT EXISTS cover_url text
    CHECK (cover_url IS NULL OR (cover_url LIKE 'https://%' AND char_length(cover_url) <= 1000));
GRANT INSERT (cover_url), UPDATE (cover_url) ON public.community_groups TO authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS social_youtube text
    CHECK (social_youtube IS NULL OR (social_youtube LIKE 'https://%' AND char_length(social_youtube) <= 300)),
  ADD COLUMN IF NOT EXISTS social_snapchat text
    CHECK (social_snapchat IS NULL OR (social_snapchat LIKE 'https://%' AND char_length(social_snapchat) <= 300)),
  ADD COLUMN IF NOT EXISTS social_x text
    CHECK (social_x IS NULL OR (social_x LIKE 'https://%' AND char_length(social_x) <= 300));

COMMIT;
