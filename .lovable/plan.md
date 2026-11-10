# ChargeMate: a community home-charger help network

A member-run network where EV owners offer their home charger to drivers who are stranded or low on range. It follows the app's location privacy rules: nobody sees an exact place until the host says yes.

## How it works

**1. Become a host (opt-in, off by default, 18+ only)**
From the EV chargers page, "Offer my charger":
- Who can ask: **Emergencies only** or **Emergencies and planned visits**
- Cost: **Free** or **Host sets a price** (for example "£10 or cash for the electricity"). RevMate never takes money and isn't part of the deal; it's agreed between members.
- Charger details: connector (Type 2 / tethered / 3-pin), speed (3/7/22 kW), driveway fit (small car / large / van), notes ("ring first", hours)
- Location: postcode district plus a point rounded to about 1 km. The exact address is never stored.
- Visibility: **Show me on the map as a host** (others see a rough distance only), or **hidden**, where you only get matched to emergency requests nearby.
- A big "Pause" switch, and one tap to stop hosting and delete everything.

**2. Need a charge**
A clear "I need a charge" button on the EV map:
- Shows nearby hosts as **distance bands only** ("under 2 mi", "2–5 mi", "5–15 mi"), with their charger type, Free/paid tag, and an Emergency tag. No pins, no areas.
- The driver sends a request: their car, connector, how much range is left, whether it's an emergency, and a short message.
- Rate-limited (a few requests an hour) so nobody can triangulate hosts.

**3. Host approves**
- The host gets a notification and chats in Messages.
- If they tap **Approve and share location**, only that driver sees the exact address or pin the host types at that moment. It isn't saved on the host profile.
- That shared location **expires automatically** (after about 4 hours, or when either person taps "Done"), then it's deleted.

**4. After the charge**
- Both members can leave a quick thumbs up or down and a note, which builds a "Trusted host" badge.
- Report and block are always available, and blocks hide both ways.

## Staying clear of responsibility
- Signing up and every request show a short agreement: arrangements are between members, RevMate doesn't check chargers or handle payments, and the host is responsible for their equipment. If you're in danger, call 999, or your breakdown cover.
- No in-app payments, ever. A paid host just shows a price note.
- New pages: a Safety tips page (meet in daylight, tell a friend, check the cable) and an update to the privacy policy.

## Also included
- A "Stranded? Call for help" panel with breakdown numbers and a link to the public charger map, so there's always a fallback.
- A public info page, "Community home chargers", explaining the idea to help with search. It shows no host data.
- Demo: two demo accounts register as hosts and one makes a test emergency request through the app.

## Technical details
- Migration (next free number):
  - `charger_hosts`: user_id PK, mode, price_note, connector, kw, fits, notes, district, lat/lng (rounded to 2 dp by a trigger), discoverable, paused, timestamps.
  - `charge_requests`: requester, host, car, connector, range_left, emergency flag, message, status (pending/approved/declined/done/expired), shared_location text, expires_at.
  - RLS: hosts manage only their own row, and nobody reads `charger_hosts` directly. A security-definer RPC `nearby_charger_hosts(district)` returns banded distances only, excluding minors, blocked users and paused hosts, with rate limiting. `shared_location` is readable only by the requester while status = approved and `expires_at > now()`; a scheduled cleanup nulls it after it expires.
  - New notification kinds for request, approved and declined.
- UI: `src/routes/ev-chargers_.community.tsx`, plus host setup and request dialogs and a requests inbox, reusing Messages and `roughMiles`.
- Update `docs/LOCATION_PRIVACY.md`, the privacy policy, the changelog, the pending-SQL docs and `roadmap.md`, and add a test for the visibility and expiry rules.
