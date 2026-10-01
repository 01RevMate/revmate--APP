<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Release history

`src/lib/changelog.ts` is the app's release history. It powers the App
updates page (`/legal/updates`) and the machine-readable `/updates.json`.
Read it to see which version is current and what has shipped. When you ship
a user-facing change, add it to the newest release or start a new one at the
top, and list any SQL it needs under `requiredSql` (plus in `PENDING_SQL.md`).

## SQL that hasn't been run yet

`PENDING_SQL.md` lists migrations that are committed but not yet applied to
the live database, and `sql-to-run/` holds ready-to-run numbered copies with
Lovable prompts in `LOVABLE_PENDING_SQL_PROMPT.md`. When you add a new
migration, add it to all three. Once a file has been run, move it into
`sql-to-run/applied/` and its entry to "Applied" in `PENDING_SQL.md`.
Lovable records what it runs as its own copies in `drizzle/migrations/`
(e.g. 0038–0040 duplicate 0035–0037), so a new migration takes the next
free number after those.

## Location is sensitive

Read `docs/LOCATION_PRIVACY.md` before building anything that uses location
(member areas, distances, maps, "nearby" features). Location is opt-in and
coarse (postcode district or ~1 km). Other members only ever see rounded
distances, never someone's area or coordinates. Under-18s are excluded from
sharing, and blocks always apply. Planned features (Find a friend, Heartbeat)
have their safety design written down there.
