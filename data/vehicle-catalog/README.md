# RevMate UK vehicle catalogue

This directory contains the import data for RevMate's linked make → model → detailed derivative → fuel selector.

- Source: Department for Transport and Driver and Vehicle Licensing Agency
- Dataset: UK vehicle licensing statistics (`df_VEH0120_UK` and `df_VEH0220`)
- Period: 2026 Q1, with 2025 engine-size bands
- Scope: passenger cars with at least one licensed or SORN vehicle in the latest quarter
- Licence: Open Government Licence v3.0

`revmate-uk-vehicle-catalog.jsonl.gz` contains 60,342 derivative/fuel combinations across 197 makes, 2,429 model families and 50,164 detailed models/derivatives.

Apply `drizzle/migrations/0012_revmate_vehicle_catalog.sql`, then run:

```sh
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVER_ONLY_KEY" \
bun run catalog:import
```

Validate the bundled file without contacting Supabase:

```sh
bun run catalog:validate
```

The service-role key is server-only. Never put it in a `VITE_` variable or browser code.

Contains public sector information licensed under the Open Government Licence v3.0.

- https://www.gov.uk/government/statistical-data-sets/vehicle-licensing-statistics-data-files
- https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/
