# Lovable prompt — apply the Friends-only feed SQL

Please apply the complete Supabase migration at:

`supabase/migrations/20260922210000_friends_only_feed.sql`

Run the migration exactly as committed and do not recreate or simplify its security policies. It adds the `public.posts.audience` field, the accepted-friend visibility check, protected friends-only photo handling, and the `friends` feed scope. Existing posts default to `public`; no posts or user data are deleted.

After applying it, confirm that the migration completed successfully. Then verify with two accepted test accounts that a Friends-only post appears in the Friends feed and cannot be opened by a signed-out user or a non-friend.
