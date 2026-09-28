import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT, resolvePostPhotos, type PostWithAuthor } from "@/lib/posts";

// Site-wide search: one query across people, cars, posts, listings,
// groups, hashtags and businesses. Each part fails quietly on its own, so
// a missing table (SQL not run yet) never breaks the rest.

const clean = (q: string) =>
  q
    .trim()
    .replace(/[%_,()*\\]/g, " ")
    .replace(/\s+/g, " ");

async function safe<T>(
  run: () => PromiseLike<{ data: T | null; error: unknown }>,
): Promise<T | []> {
  try {
    const { data, error } = await run();
    return error || !data ? [] : data;
  } catch {
    return [];
  }
}

export type SearchResults = Awaited<ReturnType<typeof searchEverything>>;

export async function searchEverything(query: string) {
  const q = clean(query);
  const handle = q.replace(/^@/, "");
  const tag = q.replace(/^#/, "").replace(/[^A-Za-z0-9_]/g, "");
  if (q.length < 2) {
    return { people: [], cars: [], posts: [], listings: [], groups: [], tags: [], businesses: [] };
  }
  const [people, cars, posts, listings, groups, tags, businesses] = await Promise.all([
    safe(() =>
      supabase
        .from("profiles")
        .select("user_id, username, avatar_url, bio")
        .or(`username.ilike.%${handle}%,bio.ilike.%${q}%`)
        .eq("account_status", "active")
        .limit(8),
    ),
    safe(() =>
      supabase
        .from("garage_cars")
        .select(
          "id, nickname, make, model, year, photo_url, profiles!garage_cars_user_id_fkey(username)",
        )
        .eq("ownership_status", "current")
        .or(`nickname.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%`)
        .limit(8),
    ),
    safe(() =>
      supabase
        .from("posts")
        .select(POST_SELECT)
        .is("group_id", null)
        .ilike("body", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(10),
    ),
    safe(() =>
      supabase
        .from("listings")
        .select("id, title, price, photos, type")
        .eq("status", "active")
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(8),
    ),
    safe(() =>
      supabase
        .from("community_groups")
        .select("id, name, slug, member_count, make_name, model_name")
        .or(`name.ilike.%${q}%,description.ilike.%${q}%,make_name.ilike.%${q}%`)
        .limit(6),
    ),
    tag.length >= 1
      ? safe(() => supabase.rpc("trending_hashtags", { prefix: tag, result_limit: 6 }))
      : Promise.resolve([]),
    safe(() =>
      supabase
        .from("businesses")
        .select("id, name, category, town, rating_avg, reviews_count, verified")
        .or(`name.ilike.%${q}%,town.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(6),
    ),
  ]);
  return {
    people: people as {
      user_id: string;
      username: string;
      avatar_url: string | null;
      bio: string | null;
    }[],
    cars: cars as unknown as {
      id: string;
      nickname: string;
      make: string;
      model: string;
      year: number | null;
      photo_url: string | null;
      profiles: { username: string } | null;
    }[],
    posts: await resolvePostPhotos(posts as unknown as PostWithAuthor[]),
    listings: listings as {
      id: string;
      title: string;
      price: number | null;
      photos: string[];
      type: string;
    }[],
    groups: groups as {
      id: string;
      name: string;
      slug: string;
      member_count: number;
      make_name: string | null;
      model_name: string | null;
    }[],
    tags: (tags as { tag: string; uses: number }[]).map((t) => ({
      tag: t.tag,
      uses: Number(t.uses),
    })),
    businesses: businesses as {
      id: string;
      name: string;
      category: string;
      town: string | null;
      rating_avg: number;
      reviews_count: number;
      verified: boolean;
    }[],
  };
}
