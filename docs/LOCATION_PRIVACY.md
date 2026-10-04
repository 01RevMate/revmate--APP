# Location & privacy rules

Location is the most sensitive thing RevMate handles. A street, a house or a
regular parking spot plus a photo of someone's car is enough to find them, and
car theft is a real risk. Any feature that touches location must follow these
rules. If something new can't follow them, it doesn't ship until it can.

## What we store today

| Data | Where | Who can see it | Used for |
|------|-------|----------------|----------|
| **Your area**: the first half of a postcode (e.g. `LS6`) | `member_areas` (0046) | Only the member (RLS) | Distances on Buy & Sell, meets and local businesses; local sponsored posts |
| Advert location: district plus a centre rounded to 2 dp (~1 km) | `listings.location_district/lat/lng` (0051) | Public, but the app shows a rounded distance and the district | "12 mi away", search near me, saved-search radius |
| Meet location | `car_meets.latitude/longitude` | Public | Distance to each meet; it's a public event the organiser chose to publish |
| "Near me" postcode on Buy & Sell | Device only (localStorage) | Nobody | Distance filter |
| "Near me" on the EV charger map | Device only, never stored or sent to RevMate | Nobody | Centres the map; OpenStreetMap only receives the map's edges to find chargers |

Posts used to carry an optional ~1 km location for the old "Near you" page.
That was removed in 0057 (the columns are dropped): a rounded point on a
public post could still be read straight from the API, which breaks rule 3.

## The rules

1. **Opt-in only.** Location is never required, and every feature works
   (less precisely) without it. Nothing is collected in the background.
2. **Coarse by default.** Keep the postcode **district** (first half) or a
   point rounded to ~1 km. Never store full postcodes, addresses or live GPS.
   Round in the database (a trigger), not just in the app.
3. **Show distances, not places.** Other members see rounded distances
   ("under a mile", "5 mi", "about 15 mi"; see `roughMiles` in
   `src/lib/myArea.ts`), never a member's area, map pin or coordinates.
   Public events (meets) and adverts can show a district or town name.
4. **Private by default, shared on purpose.** Anything that tells *other
   people* where a member is needs a separate, clearly worded switch that is
   off by default, with an "only these people" audience (never "everyone").
5. **No pinpointing by repetition.** Don't expose exact distances from
   arbitrary points. Round, add bands, rate-limit lookups, and never let
   someone query "distance from X" for lots of X values (triangulation).
6. **Under 18s get more protection.** Under-18s can't share location with
   others or appear in any "who's nearby" feature. Adults can't see minors'
   distance. (See `private.age_at_least` and AGE_LIMITS.)
7. **Blocks win.** Blocked users never see each other's distance or presence.
8. **Easy to turn off and delete.** One tap removes it. Account deletion
   removes it. It's included in "Download my data".
9. **Say why, in plain words, where it's asked for.** Like the "Your area"
   card: what it's for, who sees it (nobody), and how to remove it.
10. **Update the privacy policy** (`src/routes/legal/privacy.tsx`) whenever a
    new use of location ships.

## Planned: Find a friend (not built yet)

The idea: see how many people you follow or know are nearby, to help people
get out and meet.

Safe design:
- **Off by default.** A switch: "Let people I follow back see I'm nearby."
  The audience is **mutual follows only** (both follow each other), never
  followers in general.
- Uses **Your area** (district), not live GPS.
- Others see **counts and bands**, not a map: "6 of your mutuals are within
  10 miles". Tapping shows names in bands (under 5 mi, 5–15 mi, 15–30 mi), and
  only for people who've opted in.
- 18+ only on both sides; blocks hide both ways; no exact distances.
- You can hide from specific people without unfollowing them.
- A banner while it's on: "Your mutuals can see you're nearby", with a quick
  off switch.

## Planned: Heartbeat (not built yet)

The idea: send a "I'm out and about, anyone fancy meeting up?" ping to people
nearby.

Safe design:
- **Deliberate and short-lived.** You start a heartbeat; it lasts 1–3 hours,
  then it's gone for good. There's no "always on" mode.
- **You choose who gets it:** mutuals, members of a group you're in, or
  people attending the same meet. Never "all strangers nearby".
- Recipients see your username, a short message and a **rough distance band**,
  not your location. Suggest **public meeting spots** (a meet, a car park
  partner, a café) rather than "where I am".
- **Responses are opt-in.** People reply "I'm in" and chat happens in DMs
  (16+ rules apply). Nobody is shown who else is nearby.
- **18+ only.** Rate-limited (for example 3 a day), reportable, and admins can
  see heartbeat abuse reports. Blocks apply.
- Safety prompts: meet in public, tell a friend, use the Safety Centre.

Both need a new migration (opt-in settings table, a heartbeat table with
`expires_at`, RLS limited to the chosen audience, server functions that
return only counts and bands) and a privacy policy update before launch.
