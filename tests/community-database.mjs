// Run with PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node tests/community-database.mjs
// Isolated PostgreSQL engine; never connects to Supabase.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
process.on("uncaughtException", (error) => {
  console.error(
    error.message,
    error.where ?? "",
    error.detail ?? "",
    error.position,
    error.query?.slice(Number(error.position) - 100, Number(error.position) + 100),
  );
  process.exit(1);
});
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE TABLE auth.users(id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}', email text);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT SELECT,INSERT,DELETE ON storage.objects TO anon,authenticated;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
`);
for (const file of (await readdir("drizzle/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
  try {
    await db.exec(await readFile(`drizzle/migrations/${file}`, "utf8"));
  } catch (error) {
    throw new Error(`Migration ${file}: ${error.message}`);
  }
}
// Match Supabase installations that grant default table privileges to API roles.
await db.exec(
  "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;",
);
const ids = Array.from({ length: 7 }, (_, i) => `00000000-0000-0000-0000-00000000000${i + 1}`);
const [owner, member, outsider, mod, admin, peer, pending] = ids;
for (const [i, id] of ids.entries())
  await db.query(`INSERT INTO public.profiles(user_id,username,role) VALUES($1,$2,$3)`, [
    id,
    `user${i}`,
    id === admin ? "admin" : "user",
  ]);
let checks = 0;
async function as(user, sql, params = []) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${user ?? ""}',false); SET ROLE ${user ? "authenticated" : "anon"};`,
  );
  try {
    return await db.query(sql, params);
  } catch (e) {
    e.message = `${e.message} [${sql}]`;
    throw e;
  }
}
async function denied(user, sql, params = []) {
  await assert.rejects(() => as(user, sql, params));
  checks++;
}
async function count(user, table, where, params, expected) {
  const r = await as(user, `SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, params);
  assert.equal(r.rows[0].n, expected, `${table} ${where} for ${user}`);
  checks++;
}
await count(null, "approved_vehicle_makes", "true", [], 64);
const g = (
  await as(
    owner,
    `INSERT INTO community_groups(owner_id,name,slug,visibility,join_policy,post_policy,make_name) VALUES($1,'Private BMW','private-bmw','private','approval','moderated','bmw') RETURNING id`,
    [owner],
  )
).rows[0].id;
await count(owner, "community_groups", "id=$1 AND make_name='BMW'", [g], 1);
await denied(
  owner,
  `INSERT INTO community_groups(owner_id,name,slug,make_name) VALUES($1,'Unsupported','unsupported','Ferrari')`,
  [owner],
);
await count(owner, "group_members", "group_id=$1 AND role='owner' AND status='approved'", [g], 1);
await denied(
  outsider,
  `INSERT INTO group_members(group_id,user_id,role,status) VALUES($1,$2,'owner','approved')`,
  [g, outsider],
);
for (const u of [member, mod, peer, pending])
  await as(u, `SELECT manage_group_member($1,$2,'join')`, [g, u]);
await count(owner, "notifications", "kind='join_request'", [], 4);
await denied(member, `SELECT manage_group_member($1,$2,'approved')`, [g, member]);
for (const u of [member, mod, peer])
  await as(owner, `SELECT manage_group_member($1,$2,'approved')`, [g, u]);
await as(owner, `SELECT manage_group_member($1,$2,'moderator')`, [g, mod]);
await as(owner, `SELECT manage_group_member($1,$2,'moderator')`, [g, peer]);
await denied(mod, `SELECT manage_group_member($1,$2,'banned')`, [g, owner]);
await denied(mod, `SELECT manage_group_member($1,$2,'banned')`, [g, peer]);
await denied(mod, `SELECT manage_group_member($1,$2,'admin')`, [g, member]);
await denied(owner, `SELECT manage_group_member($1,$2,'leave')`, [g, owner]);
const p = (
  await as(
    member,
    `INSERT INTO posts(user_id,body,group_id,moderation_status) VALUES($1,'Help with my BMW',$2,'published') RETURNING id,moderation_status`,
    [member, g],
  )
).rows[0];
assert.equal(p.moderation_status, "pending");
checks++;
for (const u of [null, outsider, pending, peer])
  await count(u, "posts", "id=$1", [p.id], u === peer ? 1 : 0);
await denied(member, `UPDATE posts SET moderation_status='published' WHERE id=$1`, [p.id]);
await denied(outsider, `SELECT review_group_post($1,'published')`, [p.id]);
await as(mod, `SELECT review_group_post($1,'published')`, [p.id]);
await count(member, "posts", "id=$1", [p.id], 1);
await denied(member, `UPDATE posts SET group_id=NULL WHERE id=$1`, [p.id]);
await denied(outsider, `INSERT INTO posts(user_id,body,group_id) VALUES($1,'Intrusion',$2)`, [
  outsider,
  g,
]);
await as(member, `INSERT INTO storage.objects(bucket_id,name) VALUES('group-images',$1)`, [
  `${member}/${p.id}/image`,
]);
await as(member, `INSERT INTO post_images(post_id,image_url) VALUES($1,$2)`, [
  p.id,
  `group-images:${member}/${p.id}/image`,
]);
await count(outsider, "storage.objects", "bucket_id='group-images'", [], 0);
await count(member, "storage.objects", "bucket_id='group-images'", [], 1);
await denied(
  member,
  `INSERT INTO post_images(post_id,image_url) VALUES($1,'https://public.example/leak')`,
  [p.id],
);
await as(mod, `INSERT INTO post_comments(post_id,user_id,body) VALUES($1,$2,'Check the battery')`, [
  p.id,
  mod,
]);
await count(member, "notifications", "kind='comment' AND post_id=$1", [p.id], 1);
await count(outsider, "post_comments", "post_id=$1", [p.id], 0);
await denied(
  outsider,
  `INSERT INTO post_comments(post_id,user_id,body) VALUES($1,$2,'Intrusion')`,
  [p.id, outsider],
);
await as(mod, `SELECT manage_group_member($1,$2,'banned')`, [g, member]);
await denied(member, `SELECT manage_group_member($1,$2,'leave')`, [g, member]);
await denied(member, `SELECT manage_group_member($1,$2,'join')`, [g, member]);
await count(member, "posts", "id=$1", [p.id], 0);
await count(member, "storage.objects", "bucket_id='group-images'", [], 0);
await count(admin, "posts", "id=$1", [p.id], 1);
const pub = (
  await as(
    owner,
    `INSERT INTO community_groups(owner_id,name,slug) VALUES($1,'Public Cars','public-cars') RETURNING id`,
    [owner],
  )
).rows[0].id;
await as(outsider, `SELECT manage_group_member($1,$2,'join')`, [pub, outsider]);
await count(
  outsider,
  "group_members",
  "group_id=$1 AND user_id=$2 AND status='approved'",
  [pub, outsider],
  1,
);
const post = (
  await as(
    outsider,
    `INSERT INTO posts(user_id,body,group_id) VALUES($1,'Public car discussion',$2) RETURNING id`,
    [outsider, pub],
  )
).rows[0].id;
await count(null, "posts", "id=$1", [post], 1);
await denied(
  pending,
  `INSERT INTO post_comments(post_id,user_id,body) VALUES($1,$2,'Must join first')`,
  [post, pending],
);
await as(owner, `SELECT review_group_post($1,'rejected')`, [post]);
await count(null, "posts", "id=$1", [post], 0);
await as(admin, `UPDATE profiles SET account_status='banned' WHERE user_id=$1`, [outsider]);
await denied(outsider, `SELECT manage_group_member($1,$2,'leave')`, [pub, outsider]);
await count(owner, "community_groups", "id=$1 AND member_count=3", [g], 1);

// Reports belong to the group moderators and the central admin team, not outsiders.
await as(peer, `INSERT INTO post_reports(post_id,reporter_id,reason) VALUES($1,$2,'spam')`, [
  p.id,
  peer,
]);
await count(mod, "post_reports", "post_id=$1", [p.id], 1);
await count(pending, "post_reports", "post_id=$1", [p.id], 0);
await as(mod, `UPDATE post_reports SET status='dismissed' WHERE post_id=$1`, [p.id]);
await count(admin, "post_reports", "post_id=$1 AND status='dismissed'", [p.id], 1);
await denied(mod, `UPDATE post_reports SET details='tampered' WHERE post_id=$1`, [p.id]);
// Leaving a private group removes visibility, including direct media access.
await as(peer, `SELECT manage_group_member($1,$2,'leave')`, [g, peer]);
await count(peer, "posts", "id=$1", [p.id], 0);
await count(peer, "storage.objects", "bucket_id='group-images'", [], 0);
// Current owned-car identities determine brand/model feeds; a group never leaks into them.
const ownCar = (
  await as(
    owner,
    `INSERT INTO garage_cars(user_id,make,model,nickname) VALUES($1,'BMW','3 Series','My BMW') RETURNING id`,
    [owner],
  )
).rows[0].id;
const modCar = (
  await as(
    mod,
    `INSERT INTO garage_cars(user_id,make,model,nickname) VALUES($1,'bmw','3 series','Other BMW') RETURNING id`,
    [mod],
  )
).rows[0].id;
await count(mod, "garage_cars", "id=$1 AND make='BMW'", [modCar], 1);
await denied(
  owner,
  `INSERT INTO garage_cars(user_id,make,model,nickname) VALUES($1,'Ferrari','Roma','Nope')`,
  [owner],
);
const scopedPost = (
  await as(
    mod,
    `INSERT INTO posts(user_id,body,posted_as_garage_car_id) VALUES($1,'Public BMW owner advice',$2) RETURNING id`,
    [mod, modCar],
  )
).rows[0].id;
await as(owner, `INSERT INTO posts(user_id,body) VALUES($1,'General person discussion')`, [owner]);
assert.equal(
  (await as(owner, `SELECT count(*)::int n FROM community_feed('my_car',$1)`, [ownCar])).rows[0].n,
  1,
);
checks++;
assert.equal(
  (await as(owner, `SELECT count(*)::int n FROM community_feed('same_brand',$1)`, [ownCar])).rows[0]
    .n,
  1,
);
checks++;
assert.equal(
  (await as(owner, `SELECT count(*)::int n FROM community_feed('all') WHERE group_id IS NOT NULL`))
    .rows[0].n,
  0,
);
checks++;
assert.equal(
  (
    await as(owner, `SELECT count(*)::int n FROM community_feed('my_groups') WHERE group_id=$1`, [
      g,
    ])
  ).rows[0].n,
  1,
);
checks++;
assert.equal(
  (await as(pending, `SELECT count(*)::int n FROM community_feed('my_groups')`)).rows[0].n,
  0,
);
checks++;
assert.equal(
  (
    await as(owner, `SELECT count(*)::int n FROM community_feed('my_car',$1,'maintenance')`, [
      ownCar,
    ])
  ).rows[0].n,
  0,
);
checks++;
await denied(
  pending,
  `INSERT INTO posts(user_id,body,posted_as_garage_car_id) VALUES($1,'Fake BMW identity',$2)`,
  [pending, ownCar],
);
// Blocked users' public posts and their notifications are hidden.
await as(owner, `INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)`, [owner, mod]);
await count(owner, "posts", "id=$1", [scopedPost], 0);
// Five image limit is enforced at the database, including multi-row attempts.
const photoPost = (
  await as(owner, `INSERT INTO posts(user_id,body) VALUES($1,'Photo limit test') RETURNING id`, [
    owner,
  ])
).rows[0].id;
for (let i = 0; i < 5; i++)
  await as(owner, `INSERT INTO post_images(post_id,image_url,position) VALUES($1,$2,$3)`, [
    photoPost,
    `https://example.test/${i}`,
    i,
  ]);
await denied(
  owner,
  `INSERT INTO post_images(post_id,image_url) VALUES($1,'https://example.test/six')`,
  [photoPost],
);
// Notifications cannot be forged by a member, and can only be read by their recipient.
await denied(owner, `INSERT INTO notifications(user_id,actor_id,kind) VALUES($1,$2,'like')`, [
  pending,
  owner,
]);
await count(pending, "notifications", "user_id=$1", [owner], 0);
console.log(`PASS: migrations applied locally; ${checks} permission and lifecycle assertions.`);
await db.close();
