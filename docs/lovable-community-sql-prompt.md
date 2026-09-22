# Prompt for Lovable: apply the RevMate community SQL

Apply the SQL migration below to the connected RevMate Supabase project before testing or publishing the new community features:

`supabase/migrations/20260922120000_community_foundation.sql`

Run the complete file once in the Supabase SQL editor, after confirming the existing content-safety migration `drizzle/migrations/0014_content_safety_admin.sql` has already been applied.

The new migration creates the community foundation used by the application:

- groups and group memberships;
- owner, admin, moderator and member permissions;
- public and private group visibility;
- join approval, member bans and post approval;
- group-specific post routing;
- database-filtered All Cars, My Car, Same Brand, Popular and My Groups feeds;
- private group-image storage with membership checks;
- notifications for likes, comments, join requests and membership decisions;
- group moderation access to reports;
- database limits and row-level security for posts, comments, likes, images and notifications.

This migration does not delete existing profiles, garage cars, posts, comments, messages, listings or marketplace data. Do not rewrite or simplify its RLS policies, triggers or security-definer functions. Do not copy the old Base44 group storage model or store users as email arrays.

After the SQL succeeds:

1. Regenerate or refresh the Supabase TypeScript types if Lovable reports stale generated types. The repository already includes the required updated types.
2. Build the application.
3. Test with two real signed-in accounts: create a private approval group, request and approve membership, publish a moderated post, upload a group photo, comment, like, report, ban a member and confirm the private post/photo disappear for the removed account.
4. Confirm existing profile photo cropping, garage, messages, marketplace and general posts still work.

If the SQL editor returns an error, stop and report the exact failing statement and message. Do not partially recreate the tables through the UI and do not rerun only selected fragments.
