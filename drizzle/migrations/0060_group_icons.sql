-- Group icons: a group can show its own uploaded picture instead of a car
-- brand logo, so groups that aren't about one make (local clubs, detailing,
-- track days…) can have a proper icon. Empty = use the brand logo if the
-- group has a make, otherwise a generic icon. Additive and safe to re-run.

BEGIN;

ALTER TABLE public.community_groups
  ADD COLUMN IF NOT EXISTS icon_url text
    CHECK (icon_url IS NULL OR (icon_url LIKE 'https://%' AND char_length(icon_url) <= 1000));

-- Same column grants as the cover: owners set it when creating or editing
-- (the group_edit policy still limits updates to the group's admins).
GRANT INSERT (icon_url), UPDATE (icon_url) ON public.community_groups TO authenticated;

COMMIT;
