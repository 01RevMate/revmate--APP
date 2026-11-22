// Tests migration 0083 (search_issue_posts) on an in-memory Postgres.
// Run with: npm install --no-save @electric-sql/pglite && node scripts/sql-tests/search_issue_posts.test.mjs
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIG = new URL("../../drizzle/migrations/", import.meta.url).pathname;
const db = new PGlite();
let failures = 0;
const ok = (name, cond, extra = "") => { if (cond) console.log("PASS", name); else { failures++; console.log("FAIL", name, extra); } };
const names = async (args) => (await db.query(`SELECT body FROM public.search_issue_posts(${args})`)).rows.map((r) => r.body);

await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  CREATE SCHEMA private;
  GRANT USAGE ON SCHEMA private TO anon, authenticated;
  CREATE TABLE public.cars (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), make text, model text);
  CREATE TABLE public.garage_cars (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), make text, model text);
  CREATE TABLE public.posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, body text NOT NULL DEFAULT '',
    issue_status text, issue_system text, issue_fix text, group_id uuid,
    tagged_make text, tagged_model text, posted_as_garage_car_id uuid, car_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  GRANT SELECT ON public.posts, public.cars, public.garage_cars TO anon, authenticated;
  ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
  -- Signed-out visitors only see posts by "known adults" (user ids ending in 1).
  CREATE FUNCTION private.is_known_adult(u uuid) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT right(u::text, 1) = '1' $$;
  GRANT EXECUTE ON FUNCTION private.is_known_adult(uuid) TO anon, authenticated;
  CREATE POLICY posts_all ON public.posts FOR SELECT USING (true);
  CREATE POLICY anon_adults_only ON public.posts AS RESTRICTIVE FOR SELECT TO anon USING (private.is_known_adult(user_id));
`);
const adult = "00000000-0000-0000-0000-000000000001";
const minor = "00000000-0000-0000-0000-000000000002";
const car = (await db.query(`INSERT INTO public.cars (make, model) VALUES ('Ford', 'Fiesta') RETURNING id`)).rows[0].id;
const garage = (await db.query(`INSERT INTO public.garage_cars (make, model) VALUES ('VW', 'Golf') RETURNING id`)).rows[0].id;
const ins = (body, o = {}) => db.query(
  `INSERT INTO public.posts (user_id, body, issue_status, issue_system, issue_fix, group_id, tagged_make, tagged_model, posted_as_garage_car_id, car_id, created_at)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now() - ($11 || ' minutes')::interval)`,
  [o.user ?? adult, body, "status" in o ? o.status : "unresolved", o.system ?? "other", o.fix ?? null, o.group ?? null, o.make ?? null, o.model ?? null, o.garage ?? null, o.car ?? null, String(o.age ?? 0)]);
await ins("Water leak in the footwell after rain", { status: "resolved", fix: "Blocked scuttle drain cleared", make: "Ford", model: "Fiesta", system: "bodywork", age: 500 });
await ins("Rattle from the front end", { make: "Ford", model: "Fiesta", age: 100 });
await ins("Clutch judder pulling away", { garage, system: "gearbox", age: 50 });
await ins("Check engine light on, misfire", { car, system: "engine", age: 20 });
await ins("Private group fault", { group: "00000000-0000-0000-0000-0000000000aa", make: "Ford", model: "Fiesta" });
await ins("A non-fault post", { status: null });
await ins("Minor's fault post", { user: minor, make: "Ford", model: "Fiesta" });
for (let i = 0; i < 305; i++) await ins(`Old filler ${i}`, { make: "Honda", model: "Civic", age: 10000 + i });

try { await db.exec(fs.readFileSync(MIG + "0083_search_issue_posts.sql", "utf8")); console.log("applied 0083"); }
catch (e) { console.log("0083 FAILED", e.message); process.exit(1); }

let r = await names("p_make => 'ford', p_model => 'FIESTA'");
ok("make/model match is case-insensitive and finds tagged posts", r.includes("Water leak in the footwell after rain") && r.includes("Rattle from the front end"), r.join("|"));
ok("catalogue car is used when nothing is tagged", (await names("p_make => 'Ford'")).includes("Check engine light on, misfire"));
ok("garage car it was posted as is used", (await names("p_make => 'vw'")).join() === "Clutch judder pulling away");
ok("tagged make wins over the garage car", !(await names("p_make => 'Ford'")).includes("Clutch judder pulling away"));
ok("group posts and non-fault posts are never returned", !(await names("")).some((b) => /Private group|non-fault/.test(b)));
ok("fixed posts come first", (await names("p_make => 'Ford', p_model => 'Fiesta'"))[0] === "Water leak in the footwell after rain");
ok("resolved-only filter", (await names("p_resolved_only => true")).join() === "Water leak in the footwell after rain");
ok("system filter", (await names("p_system => 'gearbox'")).join() === "Clutch judder pulling away");
ok("word search matches different words in any order (leak footwell)", (await names("p_query => 'leak footwell'")).join() === "Water leak in the footwell after rain");
ok("word search also reads the fix text", (await names("p_query => 'scuttle drain'")).join() === "Water leak in the footwell after rain");
ok("stemming works (leaking finds leak)", (await names("p_query => 'leaking'")).includes("Water leak in the footwell after rain"));
ok("old fixes are still found past 300 newer posts", (await names("p_make => 'Honda', p_limit => 50, p_offset => 300")).length === 5);
const p1 = await names("p_make => 'Honda', p_limit => 20, p_offset => 0");
const p2 = await names("p_make => 'Honda', p_limit => 20, p_offset => 20");
ok("paging gives different pages", p1.length === 20 && p2.length === 20 && !p1.some((b) => p2.includes(b)));

// Row-level security still applies to the caller.
await db.exec("SET ROLE anon");
const anon = (await names("p_make => 'Ford', p_model => 'Fiesta'"));
await db.exec("RESET ROLE");
ok("a signed-out visitor never sees a minor's post (RLS still applies)", !anon.includes("Minor's fault post") && anon.length >= 2, anon.join("|"));
ok("a signed-in caller does get rows the visitor cannot see", (await names("p_make => 'Ford', p_model => 'Fiesta'")).includes("Minor's fault post"));

await db.exec(fs.readFileSync(MIG + "0083_search_issue_posts_down.sql", "utf8"));
const gone = await db.query("SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'search_issue_posts'");
ok("rollback removes the function and touches no posts", gone.rows[0].n === 0 && (await db.query("SELECT count(*)::int n FROM public.posts")).rows[0].n === 312);
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
