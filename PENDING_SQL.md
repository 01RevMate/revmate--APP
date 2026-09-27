# Pending SQL — not yet applied

SQL that has been committed but **not yet run** on the live database. Run
each item in order (in Lovable, or the Supabase SQL editor), then move it
to the "Applied" section with the date.

## Pending

### 1. Garage car removal reason (`ownership_end_reason`)

- File: `drizzle/migrations/0030_garage_car_ownership_end_reason.sql`
- Added: 2026-09-27
- Needed by: the "What happened to this car?" pop-up (Sold / Scrapped /
  Written off / Other) and marking a marketplace listing as sold. Until
  this runs, those actions fail with "Couldn't update car".
- Safe: adds one optional column, deletes or changes nothing, fine to run
  more than once.

```sql
ALTER TABLE public.garage_cars
  ADD COLUMN IF NOT EXISTS ownership_end_reason text
  CHECK (ownership_end_reason IN ('sold', 'scrapped', 'written_off', 'other'));
```

## Applied

_Nothing yet._
