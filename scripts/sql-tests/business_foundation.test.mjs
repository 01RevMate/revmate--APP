// Tests migration 0080 (business foundation) and its rollback on an in-memory Postgres.
// Not part of the app build. Run with:
//   npm install --no-save @electric-sql/pglite && node scripts/sql-tests/business_foundation.test.mjs
// It applies the real earlier business migrations (0046, 0070, 0071) on top of small stubs for the
// Supabase pieces (roles, auth.uid(), admin/active-account helpers), then 0080, checks the approval
// rules, visibility, revisions, follows and photo safeguards as different users, and finally runs the
// down script and checks no collected data is lost.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIG = new URL("../../drizzle/migrations/", import.meta.url).pathname;
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("CRASH:", e.message); process.exit(2); });

const A = "00000000-0000-0000-0000-00000000000a"; // owner
const B = "00000000-0000-0000-0000-00000000000b"; // other member
const ADM = "00000000-0000-0000-0000-0000000000ad"; // admin

let failures = 0;
const ok = (name, cond, extra = "") => {
  if (cond) console.log("PASS", name);
  else { failures++; console.log("FAIL", name, extra); }
};

async function as(uid, fn) {
  await db.exec(`SET ROLE ${uid ? "authenticated" : "anon"}; SELECT set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return await fn(); } finally { await db.exec("RESET ROLE;"); }
}
async function tryQ(sql, params = []) {
  try { const r = await db.query(sql, params); return { rows: r.rows }; }
  catch (e) { return { error: e.message }; }
}

// ---- stubs ----
await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  CREATE SCHEMA auth; CREATE SCHEMA private;
  GRANT USAGE ON SCHEMA auth, private TO anon, authenticated, service_role;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  CREATE TABLE public.profiles (user_id uuid PRIMARY KEY, username text, role text NOT NULL DEFAULT 'user', account_status text NOT NULL DEFAULT 'active');
  GRANT SELECT ON public.profiles TO anon, authenticated;
  CREATE FUNCTION private.is_revmate_admin(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = u AND role = 'admin') $$;
  CREATE FUNCTION private.is_active_account(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = u AND account_status = 'active') $$;
  GRANT EXECUTE ON FUNCTION private.is_revmate_admin(uuid), private.is_active_account(uuid) TO anon, authenticated;
  CREATE TABLE public.listings (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  CREATE TABLE public.garage_cars (user_id uuid, make text, fuel_type text, ownership_status text);
  CREATE TABLE public.vehicle_make_segments (make text, segment text);
  INSERT INTO public.profiles (user_id, username, role) VALUES ('${A}', 'owner', 'user'), ('${B}', 'other', 'user'), ('${ADM}', 'admin', 'admin');
  SET check_function_bodies = off;
`);

await db.exec("SET check_function_bodies = off;");
for (const f of ["0046_businesses_and_ads.sql", "0070_business_profiles.sql", "STUB_PROMOTED", "0071_member_business_management.sql", "STUB_0075"]) {
  if (f === "STUB_PROMOTED") { await db.exec("ALTER TABLE public.businesses ADD COLUMN promoted_until timestamptz;"); continue; }
  if (f === "STUB_0075") { await db.exec(`DROP POLICY IF EXISTS "reviews_read" ON public.business_reviews; CREATE POLICY "reviews_read" ON public.business_reviews FOR SELECT USING (private.is_active_account(user_id) OR user_id = auth.uid() OR private.is_revmate_admin(auth.uid()));`); continue; }
  const path = MIG + f;
  if (!fs.existsSync(path)) { console.log("skip missing", f); continue; }
  try { await db.exec(fs.readFileSync(path, "utf8")); console.log("applied", f); }
  catch (e) { console.log("PREREQ FAIL", f, e.message); }
}
await db.exec("SET check_function_bodies = on;");

// A legacy live business and a legacy suspended one, before the migration.
await db.exec(`
  INSERT INTO public.businesses (id, name, category, owner_user_id, status) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Legacy Garage', 'garage', '${A}', 'active'),
    ('22222222-2222-2222-2222-222222222222', 'Legacy Suspended', 'garage', '${A}', 'suspended');
`);

// ---- run the migration ----
const mig = fs.readFileSync(MIG + "0080_business_foundation.sql", "utf8");
try { await db.exec(mig); console.log("applied 0080"); }
catch (e) { console.log("0080 FAILED:", e.message); process.exit(1); }

// ---- grandfathering ----
const legacy = await db.query("SELECT id, approval_status, status, legacy_approved, suspended_at IS NOT NULL AS susp FROM public.businesses ORDER BY name");
ok("legacy live business stays approved + active", legacy.rows.find(r => r.id.startsWith("1111")).approval_status === "approved" && legacy.rows.find(r => r.id.startsWith("1111")).status === "active" && legacy.rows.find(r => r.id.startsWith("1111")).legacy_approved);
ok("legacy suspended stays suspended", legacy.rows.find(r => r.id.startsWith("2222")).status === "suspended" && legacy.rows.find(r => r.id.startsWith("2222")).susp);
const ready = await db.query("SELECT public.business_foundation_ready() AS r");
ok("business_foundation_ready() true after migration", ready.rows[0].r === true);
const bak = await db.query("SELECT count(*)::int AS n FROM public.business_foundation_backup_20261115");
ok("backup snapshot has the 2 rows", bak.rows[0].n === 2);

// ---- owner create is forced to draft; public cannot see it ----
let newId;
await as(A, async () => {
  const r = await tryQ(`INSERT INTO public.businesses (name, category, description, town, owner_user_id, status, approval_status, tier)
    VALUES ('New Detail Co', 'detailing', 'We detail cars properly in Leeds, mobile service.', 'Leeds', '${A}', 'draft', 'draft', 'listing') RETURNING id, approval_status, status`);
  ok("owner can insert a draft", !r.error && r.rows?.[0]?.approval_status === "draft" && r.rows[0].status === "suspended", r.error);
  newId = r.rows?.[0]?.id;
  const legacyInsert = await tryQ(`INSERT INTO public.businesses (name, category, description, owner_user_id, status) VALUES ('Sneaky', 'garage', 'x', '${A}', 'active')`);
  ok("legacy-style instant-live insert is refused by RLS", !!legacyInsert.error, JSON.stringify(legacyInsert));
  const pre = await tryQ(`INSERT INTO public.businesses (name, category, description, owner_user_id, approval_status) VALUES ('Sneaky2', 'garage', 'x', '${A}', 'approved')`);
  ok("owner cannot insert as approved", !!pre.error);
});
await as(B, async () => {
  const r = await tryQ(`SELECT id FROM public.businesses WHERE id = '${newId}'`);
  ok("another member cannot see the draft", r.rows.length === 0);
});
await as(null, async () => {
  const r = await tryQ(`SELECT id FROM public.businesses`);
  ok("anon sees only the legacy live business", r.rows.length === 1 && r.rows[0].id.startsWith("1111"), JSON.stringify(r));
});
await as(A, async () => {
  const r = await tryQ(`SELECT id FROM public.businesses WHERE id = '${newId}'`);
  ok("owner sees own draft", r.rows.length === 1);
  // direct status changes by owner are refused
  const d1 = await tryQ(`UPDATE public.businesses SET approval_status = 'approved' WHERE id = '${newId}'`);
  ok("owner cannot self-approve", !!d1.error, JSON.stringify(d1));
  const d2 = await tryQ(`UPDATE public.businesses SET tier = 'full' WHERE id = '${newId}' RETURNING tier`);
  ok("owner cannot self-upgrade tier", d2.rows?.[0]?.tier !== "full", JSON.stringify(d2));
  // draft: owner may edit directly
  const d3 = await tryQ(`UPDATE public.businesses SET name = 'New Detail Co Ltd' WHERE id = '${newId}' RETURNING name`);
  ok("owner can edit a draft's name directly", d3.rows?.[0]?.name === "New Detail Co Ltd", JSON.stringify(d3));
});

// ---- transitions ----
await as(A, async () => {
  const s = await tryQ(`SELECT public.submit_business('${newId}')`);
  ok("owner submits draft -> pending", !s.error, s.error);
  const again = await tryQ(`SELECT public.submit_business('${newId}')`);
  ok("cannot submit twice", !!again.error);
  const lock = await tryQ(`UPDATE public.businesses SET name = 'Changed While Pending' WHERE id = '${newId}'`);
  ok("name locked while pending", !!lock.error, JSON.stringify(lock));
});
await as(B, async () => {
  const r = await tryQ(`SELECT public.admin_review_business('${newId}', 'approved')`);
  ok("non-admin cannot review", !!r.error);
});
await as(ADM, async () => {
  const noReason = await tryQ(`SELECT public.admin_review_business('${newId}', 'rejected')`);
  ok("reject needs a reason", !!noReason.error);
  const nc = await tryQ(`SELECT public.admin_review_business('${newId}', 'needs_changes', 'Add your trading address')`);
  ok("admin: pending -> needs_changes", !nc.error, nc.error);
  const bad = await tryQ(`SELECT public.admin_review_business('${newId}', 'approved')`);
  ok("admin cannot approve from needs_changes", !!bad.error);
});
await as(A, async () => {
  const s = await tryQ(`SELECT public.submit_business('${newId}')`);
  ok("owner resubmits needs_changes -> pending", !s.error, s.error);
});
await as(ADM, async () => {
  const r = await tryQ(`SELECT public.admin_review_business('${newId}', 'rejected', 'Not a car business')`);
  ok("admin: pending -> rejected", !r.error, r.error);
});
await as(A, async () => {
  const a = await tryQ(`SELECT public.appeal_business('${newId}', 'We detail cars every day, please check')`);
  ok("owner appeals a rejection", !a.error, a.error);
});
await as(ADM, async () => {
  const r = await tryQ(`SELECT public.admin_review_business('${newId}', 'rejected', 'Still not suitable')`);
  ok("admin: appealed -> rejected", !r.error, r.error);
});
await as(A, async () => {
  const a = await tryQ(`SELECT public.appeal_business('${newId}', 'Please look again, more info added')`);
  ok("second appeal refused", !!a.error);
});
await as(ADM, async () => {
  const r = await tryQ(`SELECT public.admin_review_business('${newId}', 'reopen')`);
  ok("admin can reopen a rejected business -> needs_changes", !r.error, r.error);
});
await as(A, async () => { await tryQ(`SELECT public.submit_business('${newId}')`); });
await as(ADM, async () => {
  const r = await tryQ(`SELECT public.admin_review_business('${newId}', 'approved')`);
  ok("admin approves", !r.error, r.error);
});
await as(B, async () => {
  const r = await tryQ(`SELECT id, status FROM public.businesses WHERE id = '${newId}'`);
  ok("approved business is now public", r.rows.length === 1 && r.rows[0].status === "active");
});
const log = await db.query(`SELECT count(*)::int AS n FROM public.business_approval_log WHERE business_id = '${newId}'`);
ok("approval log has entries", log.rows[0].n >= 8, String(log.rows[0].n));
await as(A, async () => {
  const del = await tryQ(`DELETE FROM public.business_approval_log`);
  ok("log is append-only for members", !!del.error || del.rowCount === 0);
});

// ---- revisions: approved business stays live while edits wait ----
let revId;
await as(A, async () => {
  const direct = await tryQ(`UPDATE public.businesses SET name = 'Direct Rename' WHERE id = '${newId}'`);
  ok("approved business: direct rename refused", !!direct.error, JSON.stringify(direct));
  const r = await tryQ(`SELECT public.submit_business_revision('${newId}', '{"name":"Better Name Detailing","description":"Premium mobile detailing across Leeds and Bradford.","hacker":"x"}'::jsonb) AS id`);
  ok("owner submits a revision", !r.error, r.error);
  revId = r.rows?.[0]?.id;
});
await as(B, async () => {
  const r = await tryQ(`SELECT name FROM public.businesses WHERE id = '${newId}'`);
  ok("live name unchanged while revision pending", r.rows[0].name === "New Detail Co Ltd", JSON.stringify(r.rows));
});
await as(ADM, async () => {
  const r = await tryQ(`SELECT public.admin_review_revision('${revId}', 'approved')`);
  ok("admin approves revision", !r.error, r.error);
});
await as(B, async () => {
  const r = await tryQ(`SELECT name FROM public.businesses WHERE id = '${newId}'`);
  ok("revision applied to live row", r.rows[0].name === "Better Name Detailing", JSON.stringify(r.rows));
});

// ---- suspension ----
await as(ADM, async () => { await tryQ(`SELECT public.set_business_suspended('${newId}', true, 'Under investigation')`); });
await as(B, async () => {
  const r = await tryQ(`SELECT id FROM public.businesses WHERE id = '${newId}'`);
  ok("suspended business hidden from public", r.rows.length === 0);
});
await as(ADM, async () => { await tryQ(`SELECT public.set_business_suspended('${newId}', false)`); });

// legacy admin toggle still works
await as(ADM, async () => {
  const r = await tryQ(`UPDATE public.businesses SET status = 'suspended' WHERE id = '${newId}' RETURNING status, suspended_at IS NOT NULL AS s`);
  ok("legacy admin status toggle suspends", r.rows?.[0]?.status === "suspended" && r.rows[0].s, JSON.stringify(r));
  const r2 = await tryQ(`UPDATE public.businesses SET status = 'active' WHERE id = '${newId}' RETURNING status`);
  ok("legacy admin status toggle reactivates", r2.rows?.[0]?.status === "active", JSON.stringify(r2));
  const created = await tryQ(`INSERT INTO public.businesses (name, category, description, status) VALUES ('Admin Made', 'garage', 'Made by an admin', 'active') RETURNING approval_status, status`);
  ok("admin-created business is live (legacy behaviour)", created.rows?.[0]?.approval_status === "approved" && created.rows[0].status === "active", JSON.stringify(created));
});

// ---- tier requests ----
await as(A, async () => {
  const r = await tryQ(`SELECT public.request_business_tier('${newId}')`);
  ok("owner requests full tier", !r.error, r.error);
  const dup = await tryQ(`SELECT public.request_business_tier('${newId}')`);
  ok("duplicate tier request refused", !!dup.error);
});
let treq;
await as(ADM, async () => {
  const r = await tryQ(`SELECT id FROM public.business_tier_requests WHERE business_id = '${newId}' AND status = 'pending'`);
  treq = r.rows[0]?.id;
  const a = await tryQ(`SELECT public.admin_review_tier_request('${treq}', 'approved')`);
  ok("admin approves tier", !a.error, a.error);
  const t = await tryQ(`SELECT tier FROM public.businesses WHERE id = '${newId}'`);
  ok("tier is now full", t.rows[0].tier === "full");
});

// ---- follows ----
await as(B, async () => {
  const f = await tryQ(`INSERT INTO public.business_follows (follower_user_id, business_id) VALUES ('${B}', '${newId}')`);
  ok("member follows an approved business", !f.error, f.error);
  const other = await tryQ(`INSERT INTO public.business_follows (follower_user_id, business_id) VALUES ('${A}', '${newId}')`);
  ok("cannot follow as someone else", !!other.error);
  const list = await tryQ(`SELECT * FROM public.business_follows`);
  ok("members only see their own follow rows", list.rows.length === 1);
  const c = await tryQ(`SELECT public.business_follower_count('${newId}') AS n`);
  ok("follower count visible", c.rows[0].n === 1);
});
await as(A, async () => {
  const own = await tryQ(`INSERT INTO public.business_follows (follower_user_id, business_id) VALUES ('${A}', '${newId}')`);
  ok("owner cannot follow own business", !!own.error);
  const list = await tryQ(`SELECT * FROM public.business_follows`);
  ok("owner cannot list followers", list.rows.length === 0);
});
await as(ADM, async () => { await tryQ(`SELECT public.set_business_suspended('${newId}', true, 'investigating')`); });
await as(B, async () => {
  const c = await tryQ(`SELECT public.business_follower_count('${newId}') AS n`);
  ok("follower count hidden for hidden business", c.rows[0].n === 0);
});
await as(ADM, async () => { await tryQ(`SELECT public.set_business_suspended('${newId}', false)`); });

// ---- photos ----
let photoId;
await as(A, async () => {
  const p = await tryQ(`INSERT INTO public.business_photos (business_id, url, source) VALUES ('${newId}', 'https://x.supabase.co/storage/v1/object/public/user-media/a/1.jpg', 'business') RETURNING id, review_status`);
  ok("owner photo starts pending", !p.error && p.rows[0].review_status === "pending", JSON.stringify(p));
  photoId = p.rows?.[0]?.id;
  const self = await tryQ(`UPDATE public.business_photos SET review_status = 'approved' WHERE id = '${photoId}' RETURNING review_status`);
  ok("owner cannot self-approve photo", self.rows?.[0]?.review_status !== "approved", JSON.stringify(self));
});
await as(B, async () => {
  const r = await tryQ(`SELECT id FROM public.business_photos WHERE id = '${photoId}'`);
  ok("pending photo hidden from public", r.rows.length === 0);
});
await as(ADM, async () => {
  const r = await tryQ(`SELECT public.admin_review_photo('${photoId}', 'approved')`);
  ok("admin approves photo", !r.error, r.error);
});
await as(B, async () => {
  const r = await tryQ(`SELECT id FROM public.business_photos WHERE id = '${photoId}'`);
  ok("approved photo is public", r.rows.length === 1);
  const rep = await tryQ(`INSERT INTO public.business_photo_reports (photo_id, reporter_id, reason) VALUES ('${photoId}', '${B}', 'inappropriate') RETURNING id`);
  ok("member can report a photo", !rep.error, rep.error);
  const dup = await tryQ(`INSERT INTO public.business_photo_reports (photo_id, reporter_id, reason) VALUES ('${photoId}', '${B}', 'other')`);
  ok("only one report per photo per member", !!dup.error);
});
await as(ADM, async () => {
  const q = await tryQ(`SELECT id FROM public.business_photo_reports WHERE status = 'open'`);
  const r = await tryQ(`SELECT public.admin_resolve_photo_report('${q.rows[0].id}', 'upheld')`);
  ok("admin upholds photo report", !r.error, r.error);
});
await as(B, async () => {
  const r = await tryQ(`SELECT id FROM public.business_photos WHERE id = '${photoId}'`);
  ok("upheld photo removed from public view", r.rows.length === 0);
});

// ---- reviews follow business visibility ----
await as(B, async () => {
  const r = await tryQ(`INSERT INTO public.business_reviews (business_id, user_id, rating, body) VALUES ('${newId}', '${B}', 5, 'Great') RETURNING id`);
  ok("member can review an approved business", !r.error, r.error);
  const draftId = (await db.query(`SELECT 1`)) && null;
});
await as(B, async () => {
  const d = await tryQ(`INSERT INTO public.businesses (name, category, description, town, owner_user_id) VALUES ('Second Draft', 'garage', 'A second business to test hiding', 'Leeds', '${B}') RETURNING id`);
  if (d.error) console.log("second draft insert error:", d.error);
  const id2 = d.rows?.[0]?.id;
  await db.exec("RESET ROLE;");
  await db.exec(`INSERT INTO public.business_reviews (business_id, user_id, rating, body) VALUES ('${id2}', '${ADM}', 4, 'hidden-test')`);
  await db.exec(`SET ROLE authenticated;`);
});
await as(A, async () => {
  const r = await tryQ(`SELECT id FROM public.business_reviews WHERE body = 'hidden-test'`);
  ok("reviews of an unapproved business are hidden", r.rows.length === 0);
});

// ---- cap of 3 ----
await as(A, async () => {
  const r = await tryQ(`INSERT INTO public.businesses (name, category, description, owner_user_id) VALUES ('Cap X', 'garage', 'cap test business', '${A}')`);
  ok("owner with 3 businesses cannot add a 4th", /up to 3/.test(r.error ?? ""), JSON.stringify(r));
});
await as(B, async () => {
  let made = 0, last;
  for (let i = 0; i < 4; i++) {
    const r = await tryQ(`INSERT INTO public.businesses (name, category, description, owner_user_id) VALUES ('Cap ${i}', 'garage', 'cap test business', '${B}')`);
    if (!r.error) made++; else last = r.error;
  }
  ok("a member is capped at 3 businesses in total", made === 2 && /up to 3/.test(last ?? ""), `made=${made} ${last}`);
});


// ---- rollback preserves data and stays safe ----
const before = await db.query(`SELECT (SELECT count(*) FROM public.business_approval_log)::int AS log, (SELECT count(*) FROM public.business_follows)::int AS follows, (SELECT count(*) FROM public.business_revisions)::int AS revs, (SELECT count(*) FROM public.business_tier_requests)::int AS tiers, (SELECT count(*) FROM public.business_photo_reports)::int AS reps, (SELECT count(*) FROM public.businesses)::int AS biz`);
const pendingDraftId = (await db.query(`SELECT id FROM public.businesses WHERE name = 'Second Draft'`)).rows[0].id;
try { await db.exec(fs.readFileSync(MIG + "0080_business_foundation_down.sql", "utf8")); console.log("applied down script"); }
catch (e) { console.log("DOWN FAILED:", e.message); failures++; }
const after = await db.query(`SELECT (SELECT count(*) FROM public.business_approval_log)::int AS log, (SELECT count(*) FROM public.business_follows)::int AS follows, (SELECT count(*) FROM public.business_revisions)::int AS revs, (SELECT count(*) FROM public.business_tier_requests)::int AS tiers, (SELECT count(*) FROM public.business_photo_reports)::int AS reps, (SELECT count(*) FROM public.businesses)::int AS biz`);
ok("rollback keeps every collected row", JSON.stringify(before.rows[0]) === JSON.stringify(after.rows[0]), JSON.stringify([before.rows[0], after.rows[0]]));
const rdy = await tryQ(`SELECT public.business_foundation_ready()`);
ok("feature check is gone after rollback (app treats this as off)", !!rdy.error);
await as(A, async () => {
  const r = await tryQ(`INSERT INTO public.businesses (name, category, description, owner_user_id, status) VALUES ('Rollback Sneaky', 'garage', 'x', '${A}', 'active')`);
  ok("rollback keeps owner self-creation closed", !!r.error, JSON.stringify(r));
});
await as(A, async () => {
  const r = await tryQ(`SELECT id FROM public.businesses WHERE id = '${pendingDraftId}'`);
  ok("unapproved businesses stay hidden after rollback", r.rows.length === 0, JSON.stringify(r));
});
await as(null, async () => {
  const r = await tryQ(`SELECT count(*)::int AS n FROM public.businesses`);
  ok("approved businesses stay visible after rollback", r.rows[0].n >= 1, JSON.stringify(r));
});
await as(ADM, async () => {
  const r = await tryQ(`INSERT INTO public.businesses (name, category, description, status) VALUES ('Admin After Rollback', 'garage', 'Admin made after rollback', 'active') RETURNING status`);
  ok("admin can still create businesses after rollback", r.rows?.[0]?.status === "active", JSON.stringify(r));
});

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
