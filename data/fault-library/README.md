# Fault library

Common faults for the most popular cars on UK roads, written for the car pages (`/cars/...`). One JSON
file per car. The first four files (Fiesta, Focus, Qashqai and Golf) were reviewed and their 19
faults are in the live database. The other 21 files are **drafts for review**; their 41 faults
have not been imported. Review their source links and wording before running the importer again.

## The honesty rules

1. **Every fault has a source.** `source_url` must be an `https` link to a page that was actually read
   (a manufacturer recall notice, a reputable motoring publication, a long-running owner forum).
2. **Own words.** Write the description yourself. Never paste or lightly reword someone else's text.
3. **No estimated costs.** A cost range is only allowed with `cost_source_url`, a link to where that
   cost comes from. If you can't find a reliable cost, leave the cost fields out. The car page then
   says "Cost unknown". The app also refuses to show a cost that has no source.
4. **Say when you looked.** `last_checked` is the date the source was read.
5. Nothing is invented: if a car's year range, engine details or a fault can't be backed by a source,
   leave it out.

## File format

File name: `<make>-<model>.json`, for example `ford-fiesta.json`. Files starting with `_` are ignored.

```json
{
  "car": { "make": "Ford", "model": "Fiesta", "generation": "All years" },
  "faults": [
    {
      "title": "Short name of the fault",
      "description": "40 to 700 characters, in RevMate's own words: what happens, and what is usually done about it.",
      "source_url": "https://example.com/page-that-was-read",
      "typical_cost_low": 150,
      "typical_cost_high": 400,
      "cost_source_url": "https://example.com/where-the-cost-comes-from",
      "last_checked": "2026-11-22"
    }
  ]
}
```

- `car.make` must be an approved make (`data/approved-vehicle-makes.json`). The car page URL is made
  from the make, model and generation (`/cars/ford/fiesta/all-years`).
- Cars that aren't on RevMate yet are created (unverified, no invented details) when the file is
  imported. Cars that already exist are reused, matched on make, model and generation.
- `typical_cost_low`/`typical_cost_high` are whole pounds, and both are needed together.
- 1 to 8 faults per car.

## Commands

```sh
bun run faults:validate   # checks every file; changes nothing
```

```sh
# Needs migration 0084 (sql-to-run/37_fault_library_schema.sql) to have run first.
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVER_ONLY_KEY" \
bun run faults:import
```

The service-role key is server-only. Never put it in a `VITE_` variable or browser code.

Re-running the import is safe: a car's editorial faults are matched by title and updated in place, and
editorial faults that were removed from the file are removed. Owner-reported and AI-sourced faults are
never touched.
