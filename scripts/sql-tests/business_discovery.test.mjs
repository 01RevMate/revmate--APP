// Tests migration 0082 (business discovery: search_businesses) and its rollback on an in-memory Postgres.
// Run with: npm install --no-save @electric-sql/pglite && node scripts/sql-tests/business_discovery.test.mjs
// Applies the real earlier business migrations (0046, 0070, 0071), then 0080, 0081 and 0082, with small stubs
// for the Supabase pieces (roles, auth.uid(), auth.users, admin helpers).
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIG = process.env.MIG ?? new URL("../../drizzle/migrations/", import.meta.url).pathname;
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("CRASH:", e.message); process.exit(2); });

const OWNER = "00000000-0000-0000-0000-00000000000a";
const ADM = "00000000-0000-0000-0000-0000000000ad";
const NEWBIE = "00000000-0000-0000-0000-0000000000b0";
const LINKED = "00000000-0000-0000-0000-0000000000c0";
const NOMAIL = "00000000-0000-0000-0000-0000000000d0";
const R = (i) => `00000000-0000-0000-0000-0000000001${String(i).padStart(2, "0")}`; // reviewers 1..12

let failures = 0;
const ok = (name, cond, extra = "") => { if (cond) console.log("PASS", name); else { failures++; console.log("FAIL", name, extra); } };
async function as(uid, fn) {
  await db.exec(`SET ROLE ${uid ? "authenticated" : "anon"}; SELECT set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return await fn(); } finally { await db.exec("RESET ROLE;"); }
}
async function tryQ(sql) { try { const r = await db.query(sql); return { rows: r.rows }; } catch (e) { return { error: e.message }; } }
const one = async (sql) => (await db.query(sql)).rows[0];

// ---- stubs ----
await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  CREATE SCHEMA auth; CREATE SCHEMA private;
  GRANT USAGE ON SCHEMA auth, private TO anon, authenticated, service_role;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
  CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, username text, role text NOT NULL DEFAULT 'user', account_status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());
  GRANT SELECT ON public.profiles TO anon, authenticated;
  CREATE FUNCTION private.is_revmate_admin(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = u AND role = 'admin') $$;
  CREATE FUNCTION private.is_active_account(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = u AND account_status = 'active') $$;
  GRANT EXECUTE ON FUNCTION private.is_revmate_admin(uuid), private.is_active_account(uuid) TO anon, authenticated;
  CREATE TABLE public.listings (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  CREATE TABLE public.garage_cars (user_id uuid, make text, fuel_type text, ownership_status text);
  CREATE TABLE public.vehicle_make_segments (make text, segment text);
  SET check_function_bodies = off;
`);
const mkUser = (id, name, email, ageDays, confirmed = true, role = "user") =>
  db.exec(`INSERT INTO public.profiles (user_id, username, role, created_at) VALUES ('${id}', '${name}', '${role}', now() - interval '${ageDays} days');
           INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ('${id}', '${email}', ${confirmed ? "now()" : "NULL"});`);
await mkUser(OWNER, "owner", "boss@acme-garage.co.uk", 30);
await mkUser(ADM, "admin", "admin@revmate.test", 90, true, "admin");
await mkUser(NEWBIE, "newbie", "new@gmail.com", 0);
await mkUser(LINKED, "linked", "mate@acme-garage.co.uk", 30);
await mkUser(NOMAIL, "nomail", "nomail@gmail.com", 30, false);
for (let i = 1; i <= 12; i++) await mkUser(R(i), `rev${i}`, `rev${i}@gmail.com`, 30);

for (const f of ["0046_businesses_and_ads.sql", "0070_business_profiles.sql", "STUB_PROMOTED", "0071_member_business_management.sql", "STUB_0075", "0080_business_foundation.sql", "0081_business_trust_safety.sql", "0082_business_discovery.sql"]) {
  if (f === "STUB_PROMOTED") { await db.exec("ALTER TABLE public.businesses ADD COLUMN promoted_until timestamptz;"); continue; }
  if (f === "STUB_0075") { await db.exec(`DROP POLICY IF EXISTS "reviews_read" ON public.business_reviews; CREATE POLICY "reviews_read" ON public.business_reviews FOR SELECT USING (private.is_active_account(user_id) OR user_id = auth.uid() OR private.is_revmate_admin(auth.uid()));`); continue; }
  try { await db.exec(fs.readFileSync(MIG + f, "utf8")); console.log("applied", f); }
  catch (e) { console.log("MIGRATION FAILED", f, e.message); process.exit(1); }
  if (f.startsWith("0046")) await db.exec("SET check_function_bodies = off;");
}
await db.exec("SET check_function_bodies = on;");


const ready = await one("SELECT public.business_discovery_ready() AS r");
ok("business_discovery_ready() true after migration", ready.r === true);

const hours = (open, close) => JSON.stringify(Object.fromEntries(["mon","tue","wed","thu","fri","sat","sun"].map((d) => [d, { open, close }])));
const mkBiz = async (name, o = {}) => {
  const cols = { category: "garage", description: `${name} description text here`, town: "Leeds", postcode_district: null, status: "active", ...o };
  const keys = Object.keys(cols);
  const vals = keys.map((k) => { const v = cols[k]; return v === null ? "NULL" : typeof v === "boolean" || typeof v === "number" ? String(v) : (k === "opening_hours" ? `'${v}'::jsonb` : (k === "covers_areas" || k === "services") ? `ARRAY[${v.map((x) => `'${x}'`).join(",")}]::text[]` : `'${v.replace(/'/g, "''")}'`); });
  const r = await db.query(`INSERT INTO public.businesses (name, owner_user_id, ${keys.join(",")}) VALUES ('${name}', '${OWNER}', ${vals.join(",")}) RETURNING id`);
  return r.rows[0].id;
};
await db.exec(`SELECT set_config('request.jwt.claim.sub', '${ADM}', false)`);
const ids = {};
ids.ls6 = await mkBiz("LS6 Garage", { postcode_district: "LS6", category: "garage" });
ids.ls8 = await mkBiz("LS8 Garage", { postcode_district: "LS8", category: "garage" });
ids.covers = await mkBiz("Mobile Mechanic Co", { postcode_district: "BD1", covers_areas: ["LS6"], category: "mobile_mechanic", town: "Bradford" });
ids.town = await mkBiz("Leeds Town Garage", { postcode_district: "WF1", town: "Leeds" });
ids.national = await mkBiz("Online Parts Ltd", { category: "parts", town: "Birmingham", serves_nationwide: true, services: ["alloy wheels", "exhausts"] });
ids.far = await mkBiz("Cornwall Garage", { postcode_district: "TR1", town: "Truro" });
ids.tyres = await mkBiz("Quick Fit Tyres", { category: "tyres", postcode_district: "LS6", description: "We fit tyres and balance wheels" });
ids.always = await mkBiz("Always Open Garage", { postcode_district: "LS6", opening_hours: hours("00:00", "23:59") });
ids.never = await mkBiz("Hours Closed Garage", { postcode_district: "LS6", opening_hours: JSON.stringify({ mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null }) });
// A draft and a suspended business must never appear.
await as(R(1), async () => { const r = await tryQ(`INSERT INTO public.businesses (name, category, description, town, owner_user_id) VALUES ('Secret Draft Garage', 'garage', 'a draft that should stay private', 'Leeds', '${R(1)}')`); if (r.error) console.log("draft insert:", r.error); });
await db.exec(`SELECT set_config('request.jwt.claim.sub', '${ADM}', false)`);
ids.susp = await mkBiz("Suspended Garage", { postcode_district: "LS6" });
await db.exec(`UPDATE public.businesses SET suspended_at = now() WHERE id = '${ids.susp}'`);
// ratings: give LS8 a trusted record
for (let i = 1; i <= 5; i++) await db.exec(`INSERT INTO public.business_reviews (business_id, user_id, rating, body) VALUES ('${ids.ls8}', '${R(i)}', 5, 'great')`);
await db.exec(`UPDATE public.businesses SET promoted_until = now() + interval '30 days' WHERE id = '${ids.far}'`);

const search = async (args = "", uid = null) => as(uid, () => tryQ(`SELECT id, name, match_tier, promoted, total_count, trust_level, rating_avg FROM public.search_businesses(${args})`));
const names = (r) => (r.rows ?? []).map((x) => x.name);

let r = await search("", null);
ok("anon can search", !r.error && r.rows.length > 0, r.error);
ok("drafts and suspended businesses never appear", !names(r).includes("Secret Draft Garage") && !names(r).includes("Suspended Garage"), names(r).join(","));

r = await search("p_area => 'LS6', p_scope => 'local'", R(2));
const n = names(r);
ok("area search puts the same district first", n[0] && ["LS6 Garage", "Quick Fit Tyres", "Always Open Garage", "Hours Closed Garage"].includes(n[0]), n.join(","));
ok("then the wider area, places it covers, then nationwide", n.indexOf("LS8 Garage") > n.indexOf("Always Open Garage") && n.indexOf("Mobile Mechanic Co") > n.indexOf("LS8 Garage") && n.indexOf("Online Parts Ltd") > n.indexOf("Mobile Mechanic Co"), n.join(","));
r = await search("p_area => 'Leeds', p_scope => 'local'", R(2));
ok("a town search matches by town, with nationwide businesses after", names(r).includes("Leeds Town Garage") && names(r).indexOf("Online Parts Ltd") > names(r).indexOf("Leeds Town Garage") && !names(r).includes("Cornwall Garage"), names(r).join(","));
ok("local scope leaves out far-away businesses", !n.includes("Cornwall Garage"), n.join(","));

r = await search("p_scope => 'national'", R(2));
ok("nationwide scope returns only nationwide businesses", names(r).join() === "Online Parts Ltd", names(r).join(","));

r = await search("p_query => 'alloy'", null);
ok("search finds services", names(r).join() === "Online Parts Ltd", names(r).join(","));
r = await search("p_query => 'tyres'", null);
ok("search finds name and description matches, name first", names(r)[0] === "Quick Fit Tyres", names(r).join(","));
r = await search("p_query => 'fit', p_intent => ARRAY['tyres']::text[]", null);
ok("intent categories boost relevance without hiding other matches", names(r).includes("Quick Fit Tyres"), names(r).join(","));

r = await search("p_categories => ARRAY['tyres']::text[]", null);
ok("category filter is exact", names(r).join() === "Quick Fit Tyres", names(r).join(","));
r = await search("p_min_rating => 4", null);
ok("minimum rating needs real reviews", names(r).join() === "LS8 Garage", names(r).join(","));
r = await search("p_trusted_only => true", null);
ok("trusted-only returns trusted businesses", names(r).join() === "LS8 Garage" && r.rows[0].trust_level === "trusted", names(r).join(","));
r = await search("p_open_now => true", null);
ok("open-now includes businesses open now and excludes closed and unknown hours", names(r).join() === "Always Open Garage", names(r).join(","));

r = await search("p_sort => 'rating'", null);
ok("rating sort puts the best rated first", names(r)[0] === "LS8 Garage", names(r).join(","));
r = await search("", null);
const far = r.rows.find((x) => x.name === "Cornwall Garage");
ok("promoted businesses are flagged but not ranked higher", far?.promoted === true && names(r).indexOf("Cornwall Garage") > 3, names(r).join(","));

r = await search("p_limit => 3, p_offset => 0", null);
const r2 = await search("p_limit => 3, p_offset => 3", null);
ok("paging works and total_count is the full count", r.rows.length === 3 && r2.rows.length === 3 && Number(r.rows[0].total_count) >= 8 && names(r).every((x) => !names(r2).includes(x)), JSON.stringify([names(r), names(r2)]));

// rollback
await db.exec(fs.readFileSync(MIG + "0082_business_discovery_down.sql", "utf8"));
const gone = await tryQ("SELECT public.business_discovery_ready()");
ok("discovery readiness check is gone after rollback", !!gone.error);
const col = await one("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'serves_nationwide'");
ok("rollback keeps the serves_nationwide column and values", col.n === 1 && (await one(`SELECT serves_nationwide FROM public.businesses WHERE id = '${ids.national}'`)).serves_nationwide === true);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
