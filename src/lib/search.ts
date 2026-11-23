import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT, resolvePostPhotos, type PostWithAuthor } from "@/lib/posts";
import { cleanSearchQuery, memberSearchAllowed, searchTools } from "@/lib/searchPolicy";
import { searchBusinesses } from "@/lib/businessDiscovery";

// Site-wide search: one query across people, cars, posts, listings,
// groups, hashtags and businesses. Each part fails quietly on its own, so
// a missing table (SQL not run yet) never breaks the rest.

export type SearchResults = Awaited<ReturnType<typeof searchEverything>>;

export async function searchEverything(query: string, memberId: string | null = null) {
  const unavailable: string[] = [];
  async function safe<T>(name: string, run: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T | []> {
    try {
      const { data, error } = await run();
      if (error) { unavailable.push(name); return []; }
      return data ?? [];
    } catch { unavailable.push(name); return []; }
  }
  const q = cleanSearchQuery(query);
  const signedIn = memberSearchAllowed(memberId);
  const handle = q.replace(/^@/, "");
  const tag = q.replace(/^#/, "").replace(/[^A-Za-z0-9_]/g, "");
  if (q.length < 2) {
    return { people: [], cars: [], posts: [], listings: [], groups: [], tags: [], businesses: [], models: [], chargers: [], tools: [], unavailable };
  }
  const [people, cars, posts, listings, groups, tags, businesses, models] = await Promise.all([
    safe("People", () =>
      supabase
        .from("profiles")
        .select("user_id, username, avatar_url, bio")
        .or(`username.ilike.%${handle}%,bio.ilike.%${q}%`)
        .eq("account_status", "active")
        .limit(8),
    ),
    safe("Member cars", () => {
      let request = supabase
        .from("garage_cars")
        .select(
          "id, nickname, make, model, year, photo_url, profiles!garage_cars_user_id_fkey(username)",
        )
        .eq("ownership_status", "current");
      for (const word of q.split(" ")) request = request.or(`nickname.ilike.%${word}%,make.ilike.%${word}%,model.ilike.%${word}%`);
      return request.limit(8);
    }),
    safe("Posts", () => {
      let request = supabase
        .from("posts")
        .select(POST_SELECT)
        .is("group_id", null)
        .ilike("body", `%${q}%`);
      if (!signedIn) request = request.eq("audience", "public").not("issue_status", "is", null);
      return request.order("created_at", { ascending: false }).limit(10);
    }),
    safe("Adverts", () => {
      let request = supabase
        .from("listings")
        .select("id, title, price, photos, type")
        .eq("status", "active");
      for (const word of q.split(" ")) request = request.or(`title.ilike.%${word}%,description.ilike.%${word}%`);
      return request.limit(8);
    }),
    signedIn ? safe("Groups", () =>
      supabase
        .from("community_groups")
        .select("id, name, slug, member_count, make_name, model_name")
        .or(`name.ilike.%${q}%,description.ilike.%${q}%,make_name.ilike.%${q}%`)
        .limit(6),
    ) : Promise.resolve([]),
    signedIn && tag.length >= 1
      ? safe("Hashtags", () => supabase.rpc("trending_hashtags", { prefix: tag, result_limit: 6 }))
      : Promise.resolve([]),
    safe("Businesses", async () => ({ data: await searchBusinesses({ q }, 0, 6), error: null })),
    safe("Car research", () => {
      let request = supabase.from("cars").select("id, make, model, generation, make_slug, model_slug, generation_slug");
      for (const word of q.split(" ")) request = request.or(`make.ilike.%${word}%,model.ilike.%${word}%,generation.ilike.%${word}%`);
      return request.limit(8);
    }),
  ]);
  let resolvedPosts: PostWithAuthor[] = [];
  try { resolvedPosts = await resolvePostPhotos(posts as unknown as PostWithAuthor[]); }
  catch { unavailable.push("Post photos"); }
  const destinations = searchTools(q);
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
    posts: resolvedPosts,
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
    models: models as { id: string; make: string; model: string; generation: string; make_slug: string | null; model_slug: string | null; generation_slug: string | null }[],
    chargers: destinations.filter((tool) => tool.kind === "chargers"),
    tools: destinations.filter((tool) => tool.kind === "tools"),
    unavailable,
  };
}
