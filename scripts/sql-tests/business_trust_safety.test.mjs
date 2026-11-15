// Tests migration 0081 (business trust and safety) and its rollback on an in-memory Postgres.
// Run with: npm install --no-save @electric-sql/pglite && node scripts/sql-tests/business_trust_safety.test.mjs
// Applies the real earlier business migrations (0046, 0070, 0071), then 0080 and 0081, with small
// stubs for the Supabase pieces (roles, auth.uid(), auth.users, admin helpers).
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

for (const f of ["0046_businesses_and_ads.sql", "0070_business_profiles.sql", "STUB_PROMOTED", "0071_member_business_management.sql", "STUB_0075", "0080_business_foundation.sql", "0081_business_trust_safety.sql"]) {
  if (f === "STUB_PROMOTED") { await db.exec("ALTER TABLE public.businesses ADD COLUMN promoted_until timestamptz;"); continue; }
  if (f === "STUB_0075") { await db.exec(`DROP POLICY IF EXISTS "reviews_read" ON public.business_reviews; CREATE POLICY "reviews_read" ON public.business_reviews FOR SELECT USING (private.is_active_account(user_id) OR user_id = auth.uid() OR private.is_revmate_admin(auth.uid()));`); continue; }
  try { await db.exec(fs.readFileSync(MIG + f, "utf8")); console.log("applied", f); }
  catch (e) { console.log("MIGRATION FAILED", f, e.message); process.exit(1); }
  if (f.startsWith("0046")) await db.exec("SET check_function_bodies = off;");
}
await db.exec("SET check_function_bodies = on;");

const ready = await one("SELECT public.business_trust_ready() AS r");
ok("business_trust_ready() true after migration", ready.r === true);

// An approved business owned by OWNER (admin-created, as the older admin screen did).
let biz;
await as(ADM, async () => {
  const r = await tryQ(`INSERT INTO public.businesses (name, category, description, town, owner_user_id, status) VALUES ('Acme Garage', 'garage', 'A real garage in Leeds', 'Leeds', '${OWNER}', 'active') RETURNING id`);
  biz = r.rows[0].id;
});
const stats = async (id = biz) => one(`SELECT reviews_count, rating_avg, rating_score, reports_count, trust_level, status FROM public.businesses WHERE id = '${id}'`);
const review = (uid, id, stars, body = "ok") => tryQ(`INSERT INTO public.business_reviews (business_id, user_id, rating, body) VALUES ('${id}', '${uid}', ${stars}, '${body}') RETURNING id`);

// ---- ratings ----
await as(R(1), async () => { const r = await review(R(1), biz, 5); ok("normal review accepted", !r.error, r.error); });
let s = await stats();
ok("normal review counts", s.reviews_count === 1 && Number(s.rating_avg) === 5, JSON.stringify(s));
ok("rating_score is smoothed (one 5-star is not a 5)", Math.abs(Number(s.rating_score) - 3.875) < 0.001, JSON.stringify(s));

// ---- new account: flagged, doesn't count until cleared ----
let newRev;
await as(NEWBIE, async () => { const r = await review(NEWBIE, biz, 1, "terrible"); newRev = r.rows?.[0]?.id; ok("new account can post a review", !r.error, r.error); });
s = await stats();
ok("review from a day-old account doesn't count while flagged", s.reviews_count === 1, JSON.stringify(s));
const fl = await one(`SELECT id, kind, status FROM public.business_flags WHERE review_id = '${newRev}'`);
ok("new-account flag raised", fl?.kind === "new_account" && fl.status === "open", JSON.stringify(fl));
await as(OWNER, async () => {
  const r = await tryQ(`SELECT id FROM public.business_flags`);
  ok("owner cannot see flags", r.rows.length === 0);
});
await as(ADM, async () => {
  const r = await tryQ(`SELECT public.admin_resolve_flag('${fl.id}', 'cleared', 'Genuine customer')`);
  ok("admin clears the flag", !r.error, r.error);
});
s = await stats();
ok("cleared review now counts", s.reviews_count === 2 && Number(s.rating_avg) === 3, JSON.stringify(s));

// ---- linked account: excluded; confirm hides; owner appeals; admin upholds ----
let linkedRev, linkedFlag;
await as(LINKED, async () => { const r = await review(LINKED, biz, 5, "best garage ever"); linkedRev = r.rows?.[0]?.id; });
linkedFlag = await one(`SELECT id, kind FROM public.business_flags WHERE review_id = '${linkedRev}'`);
ok("same-company-email review flagged as linked_account", linkedFlag?.kind === "linked_account", JSON.stringify(linkedFlag));
s = await stats();
ok("linked review excluded from the score", s.reviews_count === 2, JSON.stringify(s));
await as(ADM, async () => {
  const r = await tryQ(`SELECT public.admin_resolve_flag('${linkedFlag.id}', 'confirmed', 'Works for the owner')`);
  ok("admin confirms the flag", !r.error, r.error);
});
await as(R(2), async () => {
  const r = await tryQ(`SELECT id FROM public.business_reviews WHERE id = '${linkedRev}'`);
  ok("confirmed review is hidden from the public", r.rows.length === 0);
});
await as(LINKED, async () => {
  const r = await tryQ(`SELECT id FROM public.business_reviews WHERE id = '${linkedRev}'`);
  ok("the author still sees their own review", r.rows.length === 1);
  const unhide = await tryQ(`UPDATE public.business_reviews SET hidden_at = NULL, admin_cleared = true WHERE id = '${linkedRev}' RETURNING hidden_at`);
  ok("author cannot unhide their own review", unhide.rows?.[0]?.hidden_at != null || unhide.rows?.length === 0, JSON.stringify(unhide));
});
let appeal;
await as(OWNER, async () => {
  const logRow = await tryQ(`SELECT ref_kind, ref_id FROM public.business_approval_log WHERE business_id = '${biz}' AND kind = 'flag_confirmed'`);
  ok("owner sees the decision in their log", logRow.rows?.length === 1 && logRow.rows[0].ref_kind === "flag");
  const bad = await tryQ(`SELECT public.appeal_decision('${biz}', 'flag', '${linkedFlag.id}', 'short')`);
  ok("appeal needs a real message", !!bad.error);
  const a = await tryQ(`SELECT public.appeal_decision('${biz}', 'flag', '${linkedFlag.id}', 'That reviewer is my cousin, not an employee') AS id`);
  ok("owner appeals a confirmed flag", !a.error, a.error);
  appeal = a.rows?.[0]?.id;
  const dup = await tryQ(`SELECT public.appeal_decision('${biz}', 'flag', '${linkedFlag.id}', 'Appealing again please')`);
  ok("only one appeal per decision", !!dup.error);
  const wrong = await tryQ(`SELECT public.appeal_decision('${biz}', 'report', '${linkedFlag.id}', 'Not a real report at all')`);
  ok("can't appeal something that isn't a decision against you", !!wrong.error);
});
await as(R(3), async () => {
  const r = await tryQ(`SELECT public.admin_resolve_appeal('${appeal}', 'upheld', 'x')`);
  ok("non-admin can't resolve appeals", !!r.error);
});
await as(ADM, async () => {
  const r = await tryQ(`SELECT public.admin_resolve_appeal('${appeal}', 'upheld', 'Reasonable, reinstating the review')`);
  ok("admin upholds the appeal", !r.error, r.error);
});
s = await stats();
ok("appeal restores the review and the score", s.reviews_count === 3, JSON.stringify(s));

// ---- burst: flagged, never suspended ----
for (let i = 4; i <= 8; i++) await as(R(i), async () => { await review(R(i), biz, 4); });
const burst = await one(`SELECT count(*)::int AS n FROM public.business_flags WHERE business_id = '${biz}' AND kind = 'review_burst'`);
ok("review burst raises a flag", burst.n === 1, JSON.stringify(burst));
s = await stats();
ok("a burst never suspends the business", s.status === "active", JSON.stringify(s));

// ---- review reports ----
let target;
await as(R(9), async () => { const r = await review(R(9), biz, 1, "scam"); target = r.rows?.[0]?.id; });
await as(R(9), async () => {
  const own = await tryQ(`INSERT INTO public.review_reports (review_id, reporter_id, reason) VALUES ('${target}', '${R(9)}', 'fake')`);
  ok("can't report your own review", !!own.error);
});
await as(OWNER, async () => {
  const r = await tryQ(`INSERT INTO public.review_reports (review_id, reporter_id, reason, details) VALUES ('${target}', '${OWNER}', 'not_a_customer', 'Never used us') RETURNING id`);
  ok("the business can report a review", !r.error, r.error);
  const dup = await tryQ(`INSERT INTO public.review_reports (review_id, reporter_id, reason) VALUES ('${target}', '${OWNER}', 'fake')`);
  ok("one report per review per person", !!dup.error);
});
await as(ADM, async () => {
  const q = await tryQ(`SELECT id FROM public.review_reports WHERE status = 'open'`);
  const r = await tryQ(`SELECT public.admin_resolve_review_report('${q.rows[0].id}', 'upheld', 'Not a customer')`);
  ok("admin upholds a review report", !r.error, r.error);
});
await as(R(10), async () => {
  const r = await tryQ(`SELECT id FROM public.business_reviews WHERE id = '${target}'`);
  ok("hidden review is gone for the public", r.rows.length === 0);
});
await as(OWNER, async () => {
  const a = await tryQ(`SELECT public.appeal_decision('${biz}', 'review', '${target}', 'Not sure why this would count against me') AS id`);
  ok("owner can appeal a hidden review", !a.error, a.error);
});

// ---- business reports: only upheld ones count; appeal reverses ----
let rpt;
await as(R(10), async () => {
  const r = await tryQ(`INSERT INTO public.business_reports (business_id, reporter_id, reason, details) VALUES ('${biz}', '${R(10)}', 'scam', 'x') RETURNING id`);
  rpt = r.rows?.[0]?.id;
});
s = await stats();
ok("an open report does not count against a business", s.reports_count === 0, JSON.stringify(s));
await as(ADM, async () => { await tryQ(`UPDATE public.business_reports SET status = 'upheld' WHERE id = '${rpt}'`); });
s = await stats();
ok("an upheld report counts", s.reports_count === 1, JSON.stringify(s));
let rptAppeal;
await as(OWNER, async () => {
  const log = await tryQ(`SELECT id FROM public.business_approval_log WHERE business_id = '${biz}' AND kind = 'report_upheld'`);
  ok("upheld report appears in the owner's log", log.rows.length === 1);
  const a = await tryQ(`SELECT public.appeal_decision('${biz}', 'report', '${rpt}', 'This report was about a different garage') AS id`);
  rptAppeal = a.rows?.[0]?.id; ok("owner appeals an upheld report", !a.error, a.error);
});
await as(ADM, async () => { await tryQ(`SELECT public.admin_resolve_appeal('${rptAppeal}', 'upheld', 'Report was about another business')`); });
s = await stats();
ok("upheld appeal clears the report from the count", s.reports_count === 0, JSON.stringify(s));

// ---- trust level ----
let trusted;
await as(ADM, async () => {
  const r = await tryQ(`INSERT INTO public.businesses (name, category, description, town, owner_user_id, status) VALUES ('Trusted Co', 'detailing', 'Detailing in Leeds, many happy customers', 'Leeds', '${OWNER}', 'active') RETURNING id`);
  trusted = r.rows[0].id;
});
for (let i = 1; i <= 5; i++) await as(R(i), async () => { await review(R(i), trusted, 5); });
s = await stats(trusted);
ok("five 5-star reviews and no upheld reports = trusted", s.trust_level === "trusted" && s.reviews_count === 5, JSON.stringify(s));
for (let i = 1; i <= 3; i++) await db.exec(`INSERT INTO public.business_reports (business_id, reporter_id, reason, status) VALUES ('${trusted}', '${R(i + 5)}', 'scam', 'upheld')`);
s = await stats(trusted);
ok("three upheld reports = caution", s.trust_level === "caution", JSON.stringify(s));
await as(OWNER, async () => {
  const r = await tryQ(`UPDATE public.businesses SET trust_level = 'trusted', rating_score = 5 WHERE id = '${trusted}' RETURNING trust_level, rating_score`);
  ok("owner can't edit trust_level or rating_score", r.rows?.[0]?.trust_level !== "trusted" && Number(r.rows?.[0]?.rating_score) !== 5, JSON.stringify(r));
});

// ---- spam limits ----
const caps = [];
await as(ADM, async () => {
  for (let i = 0; i < 12; i++) {
    const r = await tryQ(`INSERT INTO public.businesses (name, category, description, town, owner_user_id, status) VALUES ('Cap Biz ${i}', 'garage', 'cap test business description', 'Leeds', '${OWNER}', 'active') RETURNING id`);
    caps.push(r.rows[0].id);
  }
});
let made = 0, capErr;
await as(R(11), async () => {
  for (const id of caps) { const r = await review(R(11), id, 4); if (r.error) capErr = r.error; else made++; }
});
ok("reviews are capped at 5 a day", made === 5 && /5 reviews a day/.test(capErr ?? ""), `made=${made} ${capErr}`);
let sent = 0, repErr;
await as(R(12), async () => {
  for (const id of caps) {
    const r = await tryQ(`INSERT INTO public.business_reports (business_id, reporter_id, reason) VALUES ('${id}', '${R(12)}', 'other')`);
    if (r.error) repErr = r.error; else sent++;
  }
});
ok("reports are capped at 10 a day", sent === 10 && /10 reports a day/.test(repErr ?? ""), `sent=${sent} ${repErr}`);

// ---- business creation needs a day-old account and a confirmed email ----
const mk = (uid) => tryQ(`INSERT INTO public.businesses (name, category, description, town, owner_user_id) VALUES ('Mine ${uid.slice(-3)}', 'garage', 'a business description here', 'Leeds', '${uid}') RETURNING approval_status`);
await as(NEWBIE, async () => { const r = await mk(NEWBIE); ok("brand-new account can't add a business", /first day/.test(r.error ?? ""), JSON.stringify(r)); });
await as(NOMAIL, async () => { const r = await mk(NOMAIL); ok("unconfirmed email can't add a business", /Confirm your email/.test(r.error ?? ""), JSON.stringify(r)); });
await as(R(2), async () => { const r = await mk(R(2)); ok("established, confirmed account can add a draft business", r.rows?.[0]?.approval_status === "draft", JSON.stringify(r)); });

// ---- activity signals ----
const act = await one(`SELECT public.business_activity('${biz}') AS a`);
ok("activity signals returned for a visible business", typeof act.a.followers === "number" || act.a.followers !== undefined, JSON.stringify(act.a));

// ---- rollback keeps data ----
const before = await one(`SELECT (SELECT count(*) FROM public.business_flags)::int f, (SELECT count(*) FROM public.review_reports)::int r, (SELECT count(*) FROM public.business_appeals)::int a, (SELECT count(*) FROM public.business_reviews WHERE hidden_at IS NOT NULL)::int h`);
try { await db.exec(fs.readFileSync(MIG + "0081_business_trust_safety_down.sql", "utf8")); console.log("applied 0081 down"); }
catch (e) { console.log("DOWN FAILED", e.message); failures++; }
const after = await one(`SELECT (SELECT count(*) FROM public.business_flags)::int f, (SELECT count(*) FROM public.review_reports)::int r, (SELECT count(*) FROM public.business_appeals)::int a, (SELECT count(*) FROM public.business_reviews WHERE hidden_at IS NOT NULL)::int h`);
ok("rollback keeps flags, reports, appeals and hidden reviews", JSON.stringify(before) === JSON.stringify(after), JSON.stringify([before, after]));
const gone = await tryQ("SELECT public.business_trust_ready()");
ok("trust readiness check is gone after rollback", !!gone.error);
await as(R(4), async () => {
  const r = await tryQ(`SELECT id FROM public.business_reviews WHERE id = '${target}'`);
  ok("hidden reviews stay hidden after rollback", r.rows.length === 0, JSON.stringify(r));
});

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
