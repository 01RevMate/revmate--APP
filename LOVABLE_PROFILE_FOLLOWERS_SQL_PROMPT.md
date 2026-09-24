# Lovable prompt — apply RevMate followers and analytics SQL

Please apply the new Supabase migration below to the connected RevMate project:

`supabase/migrations/20260925090000_profile_followers_and_analytics.sql`

Run the migration exactly once. Do not rerun or alter the earlier garage-car ranking or sale-listing migrations.

After it succeeds, verify all of the following:

1. `public.profile_follows` and `public.profile_views` exist and have RLS enabled.
2. Existing accepted friendships were converted into two-way follows, while pending friend requests became a one-way follow from requester to recipient.
3. A signed-in user can follow and unfollow another active, unblocked profile, but cannot create a follow for another user or follow themselves.
4. The `Following` feed returns eligible posts from profiles the current user follows.
5. A followers-only post is visible to its author and their followers, but not to signed-out users or non-followers.
6. Following a profile creates one `profile_follow` notification for the followed person.
7. Blocking someone removes follows in both directions.
8. `record_profile_view` records at most one view per signed-in viewer, profile, and day; it must ignore self-views and blocked relationships.
9. `account_analytics()` can only be executed by authenticated users and returns figures for the current user only.

Please report the migration filename, whether it completed successfully, and the result of each verification. Do not edit application files and do not create demo users, follows, posts, notifications, or profile views.
