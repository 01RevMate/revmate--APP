# Diagnose function status (read-only findings)

## Findings
- **Code in the project:** `supabase/functions/diagnose/index.ts` uses `DIAGNOSE_MODEL` when set and falls back to `claude-haiku-5-5` otherwise.
- **Is that version deployed?** Not verified. The function has no logs at all, and I have no read-only way to see which version of the code is live. So I can't confirm the live copy has the new default.
- **Does DIAGNOSE_MODEL override it?** No. The project has only 3 secrets: GOOGLE_SEARCH_CONSOLE_API_KEY, LOVABLE_API_KEY and LOVABLE_CRON_SECRET. `DIAGNOSE_MODEL` isn't set, so any deployed copy with this code would use the default.
- **It can't run right now anyway:** `ANTHROPIC_API_KEY` isn't set, so a live call couldn't reach Claude. That fits with AI diagnosis being switched off and with there being no logs.

## Nothing was changed
No code edits, redeploys, setting changes or secret values were touched or shown.

## Optional next step (needs your go-ahead)
To prove what's deployed, the function would have to be redeployed and test-called after `ANTHROPIC_API_KEY` is added. Not done.
