# Lovable prompt — apply the in-app notifications SQL

Please apply the complete Supabase migration at:

`supabase/migrations/20260922223000_complete_in_app_notifications.sql`

Run it exactly as committed and do not recreate or simplify its security functions. It keeps the existing post-like, comment, and group notifications, then adds friend requests and acceptances, garage-car likes, answers, group-post review decisions, and admin-authored RevMate app updates. It does not enable message notifications, emails, text messages, or device push notifications.

No posts, profiles, friendships, messages, or existing notifications are deleted. After applying it, confirm the migration completed successfully and test a post like, post comment, and friend request between two test accounts.
