# RevMate community foundation

The account owns a garage. Posts may use the person's identity or a current owned car. Groups accept both identities. The database verifies car ownership and group membership; hiding a button is not the permission system.

## Included

- Discover, Joined and Managing group directory with make/model search and group creation.
- Public and private groups. Private group names/descriptions are discoverable; discussions and images are restricted.
- Open joining or approval, pending requests and cancellation, leaving, rejecting, banning and reinstating members.
- Owner, admin, moderator and member roles. Owners assign roles; moderators cannot manage peers or higher roles. Owners cannot leave and abandon their group.
- Group rules and optional post approval. Review, hide and restore posts. Group reports are visible to group moderators and central RevMate admins.
- Group posts stay out of All Cars, owner feeds, profile feeds and car pages. My Groups combines approved memberships. Existing profile, garage, messaging and marketplace flows remain the foundation.
- Database filtering before feed pagination: categories, matching model, matching make, popular and joined groups. Personal posts cannot enter the owner feeds through a car tag.
- Private group-photo bucket with five-minute signed access, five-image database limit and membership checks. Existing public images are unchanged. An already-issued signed URL remains usable until its short expiry.
- Notifications for likes, comments, join requests and membership decisions; unread state, dismissal and links to posts/groups. Polling every 30 seconds while the app is open; no email or push delivery.
- Shareable post detail URLs, sign-in prompts, loading/error states and community standards adapted from v1.3.
- Existing header identity switcher preserved. No Base44 SDK or email-array permissions imported.

## User-run SQL and release order

1. Confirm the existing `0014_content_safety_admin.sql` migration is applied.
2. Run `supabase/migrations/20260922120000_community_foundation.sql` once in the Supabase SQL editor. The transaction adds groups, memberships, notifications, a private image bucket, post destination/moderation fields, indexes, RPCs and policies. It deletes no existing posts, profiles, garage cars or listings. It replaces post visibility and report-review checks to include group permissions.
3. The application code is released to `main` as requested. Apply the SQL immediately before testing or publishing the synced Lovable build because the new feed expects these tables and functions.
4. Use two real test accounts in the deployed app to confirm create/join/approve, private photos, comments, reports, membership bans and notifications. Local SQL tests do not replace testing Supabase Storage/PostgREST and authenticated browser sessions.

No live SQL was executed by Codex. The old unfinished stash was not applied: only reusable group screen/helper source files were extracted and rewritten against the current application and moderation model.

## Validation

- `node_modules/.bin/tsc --noEmit`
- Targeted ESLint on changed components/helpers/routes
- `bun run build`
- `PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node tests/community-database.mjs`

The database test applies all existing Drizzle SQL migrations and the new migration to an isolated PostgreSQL-compatible PGlite engine with Supabase auth/storage schema stubs. It exercises real roles, RLS policies, triggers, RPCs and denied writes, including permissive Supabase-style default table grants. It never connects to production.

## Later layers

Reliable-business/dealership verification and promotion, business directories, push notifications, advanced group discovery, group ownership transfer/archiving, threaded replies, saved posts, and a unified search can build on this foundation. These are not represented as completed features. The top-nav search remains the previously requested placeholder. Existing marketplace and car-help areas are linked; they have not been replaced with the old Base44 implementations.
