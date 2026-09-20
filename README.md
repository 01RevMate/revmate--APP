# RevMate Skeleton

Build the skeleton for "RevMate" — a web app that becomes the UK's go-to place to research, discuss and trade anything car-related. Every model/generation gets its own page combining specs, common faults, MOT data placeholders, parts, a discussion group, and listings.

Set up:

1. Supabase backend with these core tables:

   - profiles (id, user_id, username, avatar_url, created_at)

   - cars (id, make, model, generation, year_start, year_end, body_type, engine_options jsonb, summary text, status: 'verified'|'unverified', created_at)

   - car_faults (id, car_id fk, title, description, typical_cost_low, typical_cost_high, source: 'ai'|'owner', upvotes, created_at)

   - questions (id, car_id fk, user_id fk, title, body, created_at)

   - answers (id, question_id fk, user_id fk, body, created_at)

   - listings (id, car_id fk, user_id fk, title, description, price, type: 'car'|'part', status, created_at)

2. Supabase Auth: email/password sign-up and login.

3. Pages:

   - Home: search bar for "find your car" (make/model), featured car pages, short pitch on what RevMate is

   - /cars/[make]/[model]/[generation]: car page showing specs, common faults list, Q&A thread, related listings, an "unverified" badge when status is unverified

   - /cars (browse/search all cars)

   - /ask: post a new question against a car

   - /sell: create a listing (car or part) against a car

   - /profile: basic user profile with "my garage" (saved cars) and their questions/listings

   - /login, /signup

4. Simple top nav: Home, Browse Cars, Ask, Sell, Profile/Login.

5. Seed the cars table with 10 real UK models across 2 niches you know well (pick two: e.g. hot hatches and classic 4x4s) with realistic specs and 2-3 common faults each, marked status = 'unverified'.

Keep the UI clean and minimal — no need for polish yet, this is a functional skeleton I'll continue building. Use Supabase for all data, no mock/local data.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ab843d07-0577-4358-a37e-6a2703bca1ea).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
