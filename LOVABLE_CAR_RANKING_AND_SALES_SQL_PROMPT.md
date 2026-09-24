# Lovable prompt — apply the car ranking, dislikes/follows, and sale-listing SQL

Please apply these two Supabase migrations, in this exact order, exactly as committed. Do not recreate, simplify, or merge their security functions — several of them (`private.notify_social_activity`, `private.enforce_single_garage_car_reaction`, `private.validate_listing_garage_car`) must be created with the full body shown in the file.

1. `supabase/migrations/20260924090000_garage_car_reactions_and_ranking.sql`
2. `supabase/migrations/20260924150000_car_sale_listings_and_feed.sql`

Migration 1 adds:
- Dislikes and follows for individual garage cars (`garage_car_dislikes`, `garage_car_follows`), each with its own RLS policies and a counter trigger, mirroring the existing `garage_car_likes` table.
- A trigger so a like and a dislike on the same car by the same user are mutually exclusive (adding one removes the other).
- A new `car_follow` notification kind, added to the existing notification dispatcher (the full `private.notify_social_activity()` function is replaced in place — this is expected, it's additive, not destructive).
- Four new ranking functions: `rank_garage_car`, `rank_garage_cars`, `rank_garage_car_brands`, `rank_garage_car_models` — read-only, ranked by likes minus dislikes, scoped to currently-owned cars only.
- Two new columns on `listings`: `garage_car_id` (links a listing to a specific owned car) and `show_car_stats` (boolean, seller-controlled), plus a trigger that rejects a listing whose `garage_car_id` doesn't belong to the same seller.

Migration 2 adds:
- A new `for_sale` value to the `post_category` enum, so a car-sale listing can be pushed to the feed as its own card type.
- Two new columns on `listings`: `mileage` (integer) and `photos` (text array).
- `listings.car_id` is changed from NOT NULL to nullable (a garage car doesn't have to be linked to the general vehicle catalog to be sold).
- A new `listing_id` column on `posts`, linking a feed post back to the listing it was created from.

Neither migration deletes or rewrites any existing data — no posts, profiles, garage cars, listings, or notifications are removed. After applying both, confirm they completed successfully, then test: liking and disliking the same garage car as one user (confirm the dislike clears when you like, and vice versa), following a car as a second account (confirm a notification appears), and creating a test listing with a `garage_car_id` that does *not* belong to the listing's `user_id` (this should be rejected by the trigger).
