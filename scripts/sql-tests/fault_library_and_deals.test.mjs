// Tests migrations 0084 (fault library schema) and 0085 (fault quote deal slot) and their rollbacks.
// Run with: npm install --no-save @electric-sql/pglite && node scripts/sql-tests/fault_library_and_deals.test.mjs
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIG = new URL("../../drizzle/migrations/", import.meta.url).pathname;
const db = new PGlite();
let failures = 0;
const ok = (name, cond, extra = "") => { if (cond) console.log("PASS", name); else { failures++; console.log("FAIL", name, extra); } };
const tryQ = async (sql) => { try { return { rows: (await db.query(sql)).rows }; } catch (e) { return { error: e.message }; } };

await db.exec(`
  CREATE TYPE public.fault_source AS ENUM ('ai', 'owner');
  CREATE TABLE public.cars (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  CREATE TABLE public.car_faults (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), car_id uuid REFERENCES public.cars(id),
    title text NOT NULL, description text, typical_cost_low int, typical_cost_high int,
    source public.fault_source NOT NULL DEFAULT 'owner', source_url text, upvotes int NOT NULL DEFAULT 0
  );
  CREATE TABLE public.affiliate_deals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    placement text NOT NULL CHECK (placement IN ('essentials', 'ev_chargers', 'fuel', 'marketplace')),
    partner text NOT NULL, title text NOT NULL, blurb text NOT NULL DEFAULT '', url text NOT NULL,
    cta text NOT NULL DEFAULT 'View deal', active boolean NOT NULL DEFAULT false,
    sort_order int NOT NULL DEFAULT 0, clicks int NOT NULL DEFAULT 0
  );
  INSERT INTO public.affiliate_deals (placement, partner, title, url) VALUES ('essentials', 'BookMyGarage', 'Book your MOT', 'https://www.bookmygarage.com/');
`);
const car = (await db.query("INSERT INTO public.cars DEFAULT VALUES RETURNING id")).rows[0].id;
await db.exec(`INSERT INTO public.car_faults (car_id, title, description, typical_cost_low, typical_cost_high, source) VALUES ('${car}', 'Old AI fault', 'text', 100, 300, 'ai')`);

await db.exec(fs.readFileSync(MIG + "0084_fault_library_schema.sql", "utf8"));
ok("existing faults are untouched by 0084", (await db.query("SELECT title, typical_cost_low, source FROM public.car_faults")).rows[0].source === "ai");
let r = await tryQ(`INSERT INTO public.car_faults (car_id, title, source, source_url, cost_source_url, last_checked) VALUES ('${car}', 'Editorial fault', 'editorial', 'https://a.example/x', 'https://b.example/y', '2026-11-20')`);
ok("an editorial fault with sources can be inserted", !r.error, r.error);
r = await tryQ(`INSERT INTO public.car_faults (car_id, title, cost_source_url) VALUES ('${car}', 'Bad cost source', 'http://insecure.example')`);
ok("a non-https cost source is refused", !!r.error);
await db.exec(fs.readFileSync(MIG + "0084_fault_library_schema_down.sql", "utf8"));
ok("0084 rollback keeps every fault and its sources", (await db.query("SELECT count(*)::int n FROM public.car_faults WHERE cost_source_url IS NOT NULL")).rows[0].n === 1 && (await db.query("SELECT count(*)::int n FROM public.car_faults")).rows[0].n === 2);

await db.exec(fs.readFileSync(MIG + "0085_fault_quote_deal_slot.sql", "utf8"));
const deal = (await db.query("SELECT placement, partner, active, url FROM public.affiliate_deals WHERE placement = 'faults'")).rows;
ok("starter quote deal exists, switched off, at the normal website", deal.length === 1 && deal[0].partner === "BookMyGarage" && deal[0].active === false && deal[0].url === "https://www.bookmygarage.com/", JSON.stringify(deal));
r = await tryQ(`INSERT INTO public.affiliate_deals (placement, partner, title, url) VALUES ('faults', 'Other', 'Other', 'https://x.example/')`);
ok("the faults placement is now allowed", !r.error, r.error);
r = await tryQ(`INSERT INTO public.affiliate_deals (placement, partner, title, url) VALUES ('nonsense', 'Other', 'Other', 'https://x.example/')`);
ok("other placements are still validated", !!r.error);
await db.exec(fs.readFileSync(MIG + "0085_fault_quote_deal_slot.sql", "utf8"));
ok("0085 is safe to run twice (no duplicate starter deal)", (await db.query("SELECT count(*)::int n FROM public.affiliate_deals WHERE placement = 'faults' AND partner = 'BookMyGarage'")).rows[0].n === 1);
await db.exec(fs.readFileSync(MIG + "0085_fault_quote_deal_slot_down.sql", "utf8"));
const after = (await db.query("SELECT placement, partner FROM public.affiliate_deals ORDER BY partner")).rows;
ok("0085 rollback removes the untouched starter and keeps admin-made deals", !after.some((d) => d.placement === "faults") && after.some((d) => d.partner === "Other"), JSON.stringify(after));
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
