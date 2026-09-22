# Lovable prompt — apply RevMate's approved vehicle brands

Please apply the following migration to the connected Supabase project:

supabase/migrations/20260922193000_approved_vehicle_makes.sql

This creates RevMate's exact 64-brand allowlist and enforces it for new garage cars, curated car pages and make-specific community groups. It also limits the public vehicle-make catalogue to the approved brands.

The migration deliberately preserves existing historical records. It does not delete users, garage cars, posts, groups, models, trims or fuel data. Unsupported brands disappear from the app and cannot be used for new records.

After applying it, confirm:

1. The migration completed without errors.
2. select count(*) from public.approved_vehicle_makes; returns 64.
3. A garage car using BMW can be created and is stored as BMW.
4. A new garage car using an unapproved make is rejected with Unsupported vehicle make.
5. General community groups with no make still work.

Do not rewrite or replace the list. The names and casing in the migration are the approved product list supplied by Jordan.
