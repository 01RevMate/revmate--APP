import { useQuery } from "@tanstack/react-query";
import { looseDb as db } from "@/lib/looseDb";

// Shops (0066): UK brands and small makers selling car stuff, from big parts
// sellers to someone making air fresheners at home. Members apply to list a
// shop, an admin approves it, and products link out to the shop's own site
// (RevMate doesn't take the payment). Business-style promotion is labelled.

export const SHOP_CATEGORIES = [
  { id: "parts", label: "Parts", emoji: "🔩" },
  { id: "detailing", label: "Detailing & care", emoji: "🧽" },
  { id: "fresheners", label: "Air fresheners", emoji: "🌲" },
  { id: "styling", label: "Styling & wraps", emoji: "🎨" },
  { id: "wheels_tyres", label: "Wheels & tyres", emoji: "🛞" },
  { id: "tech", label: "Tech & gadgets", emoji: "📱" },
  { id: "performance", label: "Performance", emoji: "🏁" },
  { id: "merch", label: "Merch & clothing", emoji: "👕" },
] as const;

export type ShopCategory = (typeof SHOP_CATEGORIES)[number]["id"];

export function shopCategoryLabel(id: string) {
  const c = SHOP_CATEGORIES.find((x) => x.id === id);
  return c ? `${c.emoji} ${c.label}` : id;
}

export type Shop = {
  id: string;
  owner_user_id: string | null;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  logo_url: string | null;
  website: string;
  categories: ShopCategory[];
  made_in_uk: boolean;
  status: "pending" | "active" | "rejected";
  promoted_until: string | null;
  created_at: string;
};

export type ShopProduct = {
  id: string;
  shop_id: string;
  title: string;
  price_pence: number | null;
  image_url: string | null;
  url: string;
  active: boolean;
  sort_order: number;
  clicks: number;
};

export function isPromotedShop(shop: Pick<Shop, "promoted_until">) {
  return !!shop.promoted_until && new Date(shop.promoted_until).getTime() > Date.now();
}

/** Number of live shops, or null until the SQL has run. */
export function useShopCount(): number | null {
  const { data } = useQuery({
    queryKey: ["shops", "count"],
    queryFn: async () => {
      const { data, error } = await db.from("shops").select("id").eq("status", "active").limit(50);
      return error ? null : (data as unknown[]).length;
    },
    staleTime: 10 * 60_000,
    retry: false,
  });
  return data ?? null;
}

export async function fetchShops(category?: string): Promise<Shop[]> {
  let q = db.from("shops").select("*").eq("status", "active").order("created_at", {
    ascending: false,
  });
  if (category) q = q.contains("categories", [category]);
  const { data, error } = await q.limit(200);
  if (error) throw new Error(error.message);
  const shops = data as Shop[];
  // Promoted first (always labelled), otherwise newest first.
  return [...shops].sort((a, b) => Number(isPromotedShop(b)) - Number(isPromotedShop(a)));
}

export async function fetchShop(
  slug: string,
): Promise<{ shop: Shop; products: ShopProduct[] } | null> {
  const { data, error } = await db.from("shops").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const shop = data as Shop;
  const { data: products, error: pErr } = await db
    .from("shop_products")
    .select("*")
    .eq("shop_id", shop.id)
    .order("sort_order")
    .order("created_at");
  if (pErr) throw new Error(pErr.message);
  return { shop, products: products as ShopProduct[] };
}

export async function fetchMyShops(userId: string): Promise<Shop[]> {
  const { data, error } = await db
    .from("shops")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Shop[];
}

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "shop"
  );
}

export type ShopInput = {
  name: string;
  tagline: string;
  description: string;
  logo_url: string | null;
  website: string;
  categories: ShopCategory[];
  made_in_uk: boolean;
};

/** Applies to list a shop (starts as pending until an admin approves it). */
export async function applyForShop(input: ShopInput): Promise<string> {
  const base = slugify(input.name);
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await db.from("shops").insert({ ...input, slug });
    if (!error) return slug;
    if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  }
  throw new Error("That shop name is taken. Try a slightly different name.");
}

export async function updateShop(id: string, input: Partial<ShopInput>) {
  const { error } = await db.from("shops").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteShop(id: string) {
  const { error } = await db.from("shops").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type ProductInput = Pick<
  ShopProduct,
  "title" | "price_pence" | "image_url" | "url" | "active"
>;

export async function saveProduct(shopId: string, id: string | null, input: ProductInput) {
  const { error } = id
    ? await db.from("shop_products").update(input).eq("id", id)
    : await db.from("shop_products").insert({ ...input, shop_id: shopId });
  if (error) throw new Error(error.message);
}

export async function deleteProduct(id: string) {
  const { error } = await db.from("shop_products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function recordShopClick(productId: string) {
  // Supabase only sends the request once something waits on it.
  void db.rpc("record_shop_click", { product_id: productId }).then(() => undefined);
}

// ---------- Admin ----------

export async function fetchShopsForAdmin(): Promise<Shop[]> {
  const { data, error } = await db
    .from("shops")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data as Shop[];
}

export async function setShopStatus(id: string, status: Shop["status"]) {
  const { error } = await db.from("shops").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}
