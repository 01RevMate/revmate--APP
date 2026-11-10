import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.profiles(user_id uuid PRIMARY KEY, username text, avatar_url text, age int DEFAULT 30);
CREATE FUNCTION private.is_active_account(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1 IS NOT NULL $$;
CREATE FUNCTION private.age_at_least(uid uuid, y int) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce((SELECT age FROM public.profiles WHERE user_id=uid) >= y, true) $$;
CREATE TABLE public.user_blocks(blocker_id uuid, blocked_id uuid);
CREATE FUNCTION private.users_are_blocked(a uuid, b uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM public.user_blocks WHERE (blocker_id=a AND blocked_id=b) OR (blocker_id=b AND blocked_id=a)) $$;
CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, actor_id uuid, kind text, message text, action_url text);
GRANT USAGE ON SCHEMA public,auth,private TO anon,authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
`);
for (const f of ["0072_community_charger_network.sql", "0073_charge_notification_links.sql"])
  await db.exec(await readFile(`drizzle/migrations/${f}`, "utf8"));
await db.exec("GRANT EXECUTE ON FUNCTION private.expire_charge_requests() TO authenticated");

const host = "00000000-0000-0000-0000-000000000001";
const driver = "00000000-0000-0000-0000-000000000002";
const teen = "00000000-0000-0000-0000-000000000003";
await db.exec(`INSERT INTO profiles VALUES ('${host}','@Host',null,40),('${driver}','@Driver',null,30),('${teen}','@Teen',null,16)`);
const as = (uid) => db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${uid}',false);`);

// Host location is rounded to ~1 km.
await as(host);
await db.query("INSERT INTO charger_hosts(user_id,district,lat,lng) VALUES($1,'ls6',53.81234,-1.56789)", [host]);
const h = (await db.query("SELECT lat,lng,district FROM charger_hosts")).rows[0];
assert.equal(Number(h.lat), 53.81); assert.equal(Number(h.lng), -1.57); assert.equal(h.district, "LS6");

// Under-18s cannot host.
await as(teen);
await assert.rejects(() => db.query("INSERT INTO charger_hosts(user_id,district,lat,lng) VALUES($1,'LS6',53.8,-1.5)", [teen]));

// Drivers can't read the host table; the search returns a band, not a place.
await as(driver);
assert.equal((await db.query("SELECT * FROM charger_hosts")).rows.length, 0);
const found = (await db.query("SELECT * FROM nearby_charger_hosts(53.80,-1.55,true)")).rows;
assert.equal(found.length, 1); assert.equal(found[0].band, "Under 2 mi");
assert.equal("lat" in found[0], false);
// Emergency-only hosts don't show up for planned visits.
assert.equal((await db.query("SELECT * FROM nearby_charger_hosts(53.80,-1.55,false)")).rows.length, 0);

// Request → approve → only the two members see the place, and only until it expires.
const rid = (await db.query("SELECT request_charge($1,'Kia Niro','type2',8,true,'Please!') AS id", [host])).rows[0].id;
await assert.rejects(() => db.query("SELECT shared_location FROM charge_requests"));
await as(host);
await db.query("SELECT respond_charge_request($1,'approve','12 Demo Road')", [rid]);
await as(driver);
assert.equal((await db.query("SELECT shared_location FROM my_charge_requests()")).rows[0].shared_location, "12 Demo Road");
await db.exec(`RESET ROLE; UPDATE charge_requests SET expires_at = now() - interval '1 minute';`);
await as(driver);
const after = (await db.query("SELECT status, shared_location FROM my_charge_requests()")).rows[0];
assert.equal(after.status, "expired"); assert.equal(after.shared_location, null);
await db.exec("RESET ROLE");
assert.equal((await db.query("SELECT shared_location FROM charge_requests")).rows[0].shared_location, null);

// Blocks hide hosts from search.
await db.exec(`INSERT INTO user_blocks VALUES ('${host}','${driver}')`);
await as(driver);
assert.equal((await db.query("SELECT * FROM nearby_charger_hosts(53.80,-1.55,true)")).rows.length, 0);

await db.close();
console.log("Community charger rounding, age, banding, approval, expiry and block checks passed.");
