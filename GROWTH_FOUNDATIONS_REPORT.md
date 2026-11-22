# Growth foundations report

Branch `growth-foundations`. One commit per task. Nothing was applied to the live database, no external account was created, and no secret was added or changed.

## Follow-up on 22 November 2026

The original status below is a snapshot from before rollout. The live database now has migrations 0083–0085 and the 19 reviewed editorial faults. A live audit found **89** AI-sourced faults across 39 cars with no source URLs, rather than 11. Migration 0086 hides those 89 claims from public reads while retaining every row for later source review. Signed-out reads return the 19 editorial faults. The `diagnose` function's deployed revision remains unverified.

The remaining 21 cars now have draft files in `data/fault-library/`: 41 additional fault descriptions, each linked to a page read on 22 November 2026, with no repair costs. The full 25-file library validates (60 faults). These 21 drafts need Jordan's source and wording review before import; they are not live.

## Status at a glance

| # | Task | Status |
|---|------|--------|
| 1 | Live database audit | **Not run.** I can't reach the RevMate database from here. SQL for you below. |
| 2 | Server-rendered car page, `/issues`, `/posts/$postId` | Done. |
| 3 | Sitemap | Done. |
| 4 | Word-based fault search | Done. Needs migration 0083. Falls back to the old search until it runs. |
| 5 | Default diagnosis model | Done in code. Needs an edge function redeploy. |
| 6 | Fault library pipeline and content | Pipeline done. **Content: 4 of the 25 cars drafted** (details below). |
| 7 | "Get a fixed-price quote" slot | Done. Needs migration 0085. Deal is switched off. |

## 1. Live database audit (SQL for Jordan)

The Lovable connector here only sees other projects, so I did not query anything. Run these read-only in the Lovable SQL editor and send me the results:

```sql
-- Fault posts: how many, how many resolved, how many are public to signed-out visitors
SELECT count(*) AS fault_posts,
       count(*) FILTER (WHERE issue_status = 'resolved') AS resolved,
       count(*) FILTER (WHERE group_id IS NOT NULL) AS in_groups
FROM public.posts WHERE issue_status IS NOT NULL;

-- Cars: total, with at least one fault, with at least one fault post
SELECT (SELECT count(*) FROM public.cars) AS cars,
       (SELECT count(DISTINCT car_id) FROM public.car_faults) AS cars_with_faults,
       (SELECT count(DISTINCT car_id) FROM public.posts WHERE issue_status IS NOT NULL AND car_id IS NOT NULL) AS cars_with_fault_posts;

-- Fault sources
SELECT source, count(*) FROM public.car_faults GROUP BY source;

-- Existing indexes on posts (to see what search had before)
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'posts';
```

## 2. Server rendering

- Car page, `/issues` and `/posts/$postId` now load their data in route loaders, so the first HTML from the server contains the real content. After the first load, navigation behaves as before.
- Car pages get a real title and description (top faults named), `ItemList` structured data and breadcrumbs. Resolved fault posts get `QAPage` structured data. Non-fault posts stay `noindex`.
- If a loader fails or is slow (4 s), the page falls back to client rendering rather than erroring. A missing car returns a proper 404.
- `/posts/:id` was behind the sign-in wall, so server-rendered content would never have reached Google. I added a gate (`PublicFaultPostGate` in `src/components/AuthGate.tsx`): **signed-out visitors can see fault posts only**. All other posts stay gated. The 18+ rule is untouched: the posts query still only returns adults' content to signed-out visitors, because it relies on the same RLS.
- **Before/after proof:** I compared the old build (git worktree) with the new one during development: before, the HTML for these pages contained only the app shell; after, it contains the car/fault/post text and the JSON-LD. To reproduce: `curl -s http://localhost:PORT/issues | grep -c "<script type=\"application/ld+json\""` against each build. I haven't pasted the raw HTML here because it was not saved before context was compacted. Re-run the curl to confirm.

## 3. Sitemap

`src/routes/sitemap[.]xml.ts` now lists every car with at least one fault or public fault post (any status), plus every public fault post with `lastmod`. URL segments are encoded properly (slugs containing `/` or brackets). It becomes a sitemap index at `/sitemap.xml` with pages at `?page=N` once past 5,000 URLs. Local check: 40 car URLs listed where before there were none.

## 4. Fault search

Migration `0083_search_issue_posts` adds a GIN index and `search_issue_posts()` (SECURITY INVOKER, so all existing row rules still apply): filters in the database, matches words, ranks resolved first then relevance then newest, pages with limit/offset. `/issues` has "Show more". The tiny unstyled search box only shows once the function exists. 16 SQL checks pass in an in-memory Postgres.

## 5. Default diagnosis model

`supabase/functions/diagnose/index.ts` now defaults to `claude-haiku-5-5` (still overridable with `DIAGNOSE_MODEL`). I did not switch the AI feature on. **Manual step: redeploy the `diagnose` edge function.** Risk to watch: the request sets `effort: "low"`; I left that unchanged.

## 6. Fault library

### Pipeline (done)
- `data/fault-library/*.json`, validator `scripts/lib/fault-library.mjs`, importer `scripts/import-fault-library.mjs`, commands `bun run faults:validate` and `bun run faults:import` (supports `--dry-run`).
- The validator rejects any fault with no `source_url`, and any cost with no `cost_source_url`. 7 tests cover this.
- Migration `0084_fault_library_schema`: adds `editorial` as a fault source, plus `cost_source_url` and `last_checked`. The car page only shows a cost when it has a source.
- The importer is **not** run against the live database.

### Content (honest coverage: 4 of 25)
I could only use sources I actually opened. Most of the best sources (Parkers, What Car, Autocar) returned HTTP 402 and Top Gear returned 403 to automated fetches, so I did not use them or fill from memory.

| Car | File | Status |
|-----|------|--------|
| Ford Fiesta | `ford-fiesta.json` | 5 faults. Sources: Auto Express, What Car news page (2013, old). For review. |
| VW Golf | `volkswagen-golf.json` | 5 faults, Mk7 only. Source: Carbuyer. For review. |
| Ford Focus | `ford-focus.json` | 4 faults, Mk3 only. Source: Carbuyer. For review. |
| Nissan Qashqai | `nissan-qashqai.json` | 5 faults, 2014-2021. Source: Carbuyer. For review. |
| Vauxhall Corsa | none | All three sources blocked. |
| The other 20 | none | Not started: VW Polo, Toyota Yaris, Vauxhall Astra, MINI Cooper, BMW 3 Series, Audi A3, Kia Sportage, Fiat 500, Nissan Juke, BMW 1 Series, Mercedes A-Class, Ford Kuga, VW Tiguan, Honda Jazz, Mercedes C-Class, Renault Clio, Vauxhall Mokka, Toyota Aygo, Hyundai i10, Audi A1. |

Notes on the four files: all say "All years" but several faults are tied to one generation in the text, and a single source (Carbuyer) backs most of them. **No costs are included.** The only figures found were a 2013 page with no currency sign and a cambelt service item that isn't a fault. Please review wording and add costs only where you have a source. The top-25 list itself was taken from DfT licensing data in `data/vehicle-catalog/`.

### The existing AI-sourced fault entries
The live database contains 89 such rows across 39 cars, all without source URLs. They are now hidden from public reads by migration 0086, while the rows remain available for review. Query them with: `SELECT id, car_id, title FROM public.car_faults WHERE source = 'ai';`

## 7. Fixed-price quote slot

Migration `0085_fault_quote_deal_slot` adds a `faults` placement and a **switched-off** BookMyGarage starter deal. The `DealsStrip` ("Ad" label, hidden for Plus members) appears on car pages and resolved fault posts. It shows nothing until the deal is switched on in admin.

## New migrations and run order

Run in this order in Lovable (files in `sql-to-run/`, prompts in `LOVABLE_PENDING_SQL_PROMPT.md` as G1–G3, listed in `PENDING_SQL.md`):

1. `36_search_issue_posts.sql` (0083)
2. `37_fault_library_schema.sql` (0084)
3. `38_fault_quote_deal_slot.sql` (0085)

All are additive with down scripts. The app keeps working before each one is run.

## UI added that needs designing

- `/issues`: an unstyled word-search form and a "Show more" button.
- Car page and resolved fault post: the "Get a fixed-price quote" `DealsStrip` (existing component, new placement) and a "cost source" link next to sourced costs.

## Not done, and why

- Live database audit: no access (SQL above).
- 21 of 25 fault files: sources were blocked or I ran out of room. Nothing was invented to fill the gap.
- Lint: `bun run lint` fails on about 6,400 existing formatting errors across the repo. Files I touched add no non-formatting lint errors. Typecheck, build and all 30 bun tests pass, plus the SQL tests in `scripts/sql-tests/`.

## Manual steps for Jordan

1. Run the three SQL files above.
2. Redeploy the `diagnose` edge function.
3. Review `data/fault-library/*.json`, then import with your service key (see `data/fault-library/README.md`).
4. Sign up for BookMyGarage's affiliate programme yourself, then switch the deal on in admin and put your real link and terms in.
5. Source or remove the 11 AI-sourced fault entries.
6. Choose how to get the other 21 cars' sources (paste pages in, or point me at readable sources).
