# Fix a problem: AI diagnosis setup

`/diagnose` (Fix a problem) has two layers:

1. **Built-in step-by-step diagnosis.** It works for everyone, with no
   account and no AI cost. You pick what's happening (leak, warning light,
   noise, smoke, won't start…), answer 2–3 tap-to-answer questions, and get
   the likely causes with urgency, a rough UK price and a safe check to do
   yourself. The questions and causes live in `src/lib/diagnosis.ts`; edit
   that file to add or improve them.
2. **"Ask RevMate AI".** This is optional and for signed-in members only.
   The driver describes the problem in their own words. The AI gets their
   answers, their car, and what other owners of that model reported on
   RevMate. It asks up to 3 more questions, then gives its most likely
   causes.

Whenever either layer isn't sure, the page pushes **"Ask the community"**:
it opens a help post already written from the diagnosis, filed under the
right part of the car and tagged with the car. It also offers **"Find a
mechanic"**.

## Switching the AI on (works from a phone)

1. Run SQL step 26 (part of the master prompt).
2. Create an Anthropic account at **console.anthropic.com**, add billing,
   and create an **API key**.
3. Ask Lovable:
   ```
   Please add the edge function secret ANTHROPIC_API_KEY = <my key>, then
   deploy supabase/functions/diagnose exactly as committed
   (supabase/config.toml already sets verify_jwt = true for it).
   ```
4. In **Admin → Shops & AI**, set the daily limits and tap **Switch on**.

## Cost and limits

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) at low effort, to keep each
  step quick. Each step costs roughly 2–4p. A full diagnosis (1–4 AI steps)
  is usually under 15p.
- **Limits** (Admin → Shops & AI): a whole-site cap per day (default 300
  steps, roughly £6–£12 a day at most) and a per-person cap (default 15).
  When a limit is hit, people are told to try tomorrow or ask the community.
  The built-in diagnosis keeps working.
- **Cheaper model:** add the secret `DIAGNOSE_MODEL = claude-haiku-5-5` for
  a much cheaper model. It's faster but less thorough.
- **Backup model:** if Claude declines a request, the API automatically
  retries on Anthropic's recommended backup model (server-side
  `fallbacks: "default"`), so people don't hit a dead end.

## Safety

The AI is told to put safety first: urgency "stop" for brakes, steering,
tyres, fuel leaks, overheating, the red oil light and similar. It never
suggests unsafe DIY (hot coolant caps, working under a car on a jack,
high-voltage EV parts, airbags), and it says when it isn't sure. Every
result page says it's a guide, not a guarantee. The terms and privacy policy
cover this too, including that AI answers are sent to Anthropic.
