import { supabase } from "@/integrations/supabase/client";
import { usernameLookupCandidates } from "@/lib/usernames";

// Small, fast lookups used only to build search and link-preview tags in
// route loaders. They run as a signed-out visitor on the server, so row
// level security means nothing private (followers-only posts, private
// groups, blocked accounts) can ever leak into a preview. They never throw:
// a missing preview must not break the page.

const TIMEOUT_MS = 2500;

async function safely<T>(run: () => PromiseLike<T>): Promise<T | null> {
  try {
    return await Promise.race([
      run(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  }
}

export type ListingSeo = {
  id: string;
  title: string;
  description: string | null;
  headline: string | null;
  price: number | null;
  photos: string[];
  type: string;
  mileage: number | null;
  created_at: string;
  location_area?: string | null;
  seller: string | null;
  car: { make: string; model: string; year: number | null } | null;
};

export function fetchListingSeo(id: string) {
  return safely(async (): Promise<ListingSeo | null> => {
    const { data } = await supabase
      .from("listings")
      .select("*, garage_cars(make, model, year), cars(make, model)")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();
    if (!data) return null;
    const { data: seller } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", data.user_id)
      .maybeSingle();
    const row = data as typeof data & { location_area?: string | null };
    const car = row.garage_cars
      ? { make: row.garage_cars.make, model: row.garage_cars.model, year: row.garage_cars.year }
      : row.cars
        ? { make: row.cars.make, model: row.cars.model, year: null }
        : null;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      headline: row.headline,
      price: row.price,
      photos: row.photos ?? [],
      type: row.type,
      mileage: row.mileage,
      created_at: row.created_at,
      location_area: row.location_area ?? null,
      seller: seller?.username ?? null,
      car,
    };
  });
}

export function fetchPostSeo(id: string) {
  return safely(async () => {
    const { data } = await supabase
      .from("posts")
      .select(
        "id, body, created_at, category, profiles!posts_user_id_fkey(username, avatar_url), post_images(image_url, position)",
      )
      .eq("id", id)
      .maybeSingle();
    return data as {
      id: string;
      body: string;
      created_at: string;
      category: string;
      profiles: { username: string; avatar_url: string | null } | null;
      post_images: { image_url: string; position: number }[] | null;
    } | null;
  });
}

export function fetchProfileSeo(username: string) {
  return safely(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, bio, avatar_url, cover_photo_url, verified_type")
      .in("username", usernameLookupCandidates(username))
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const { data: cars } = await supabase
      .from("garage_cars")
      .select("make, model, photo_url")
      .eq("user_id", data.user_id)
      .eq("ownership_status", "current")
      .limit(5);
    return { ...data, cars: cars ?? [] };
  });
}

export function fetchGarageCarSeo(id: string) {
  return safely(async () => {
    const { data } = await supabase
      .from("garage_cars")
      .select("id, nickname, make, model, year, generation, spec, bio, photo_url, horsepower")
      .eq("id", id)
      .maybeSingle();
    return data;
  });
}

export function fetchGroupSeo(slug: string) {
  return safely(async () => {
    const { data } = await supabase
      .from("community_groups")
      .select("name, description, make_name, model_name, member_count, visibility")
      .eq("slug", slug)
      .maybeSingle();
    return data;
  });
}

export function fetchMeetSeo(id: string) {
  return safely(async () => {
    const { data } = await supabase
      .from("car_meets")
      .select(
        "id, title, description, starts_at, ends_at, location_name, address, cover_url, cancelled_at",
      )
      .eq("id", id)
      .maybeSingle();
    return data;
  });
}
