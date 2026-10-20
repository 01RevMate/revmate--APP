import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { looseDb as db } from "@/lib/looseDb";

// Money (0064_money.sql): paid listing features, RevMate Plus, Business Pro,
// affiliate Deals, the shop link and challenge sponsors. Nothing here ever
// appears in the social feed. Paid options stay hidden until an admin
// switches payments on; Deals stay hidden for Plus members.

// ---------- Settings ----------

export type MoneySettings = {
  payments_enabled: boolean;
  shop_url: string;
  shop_label: string;
  /** Marketing (0065): empty until set in Admin → Marketing. */
  tiktok_pixel_id: string;
  android_package: string;
  android_fingerprint: string;
  /** AI diagnosis (0066): admin switch in Admin → Shops & AI. */
  ai_diagnosis_enabled: boolean;
  /** RevMate Store (0067): switched on in Admin → Store. */
  store_enabled: boolean;
  store_free_delivery_over: number;
};

/** App settings, or null until the money SQL has run. */
export function useMoneySettings(): MoneySettings | null {
  const { data } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await db.from("app_settings").select("key, value");
      if (error) return null;
      const map = new Map((data as { key: string; value: string }[]).map((r) => [r.key, r.value]));
      return {
        payments_enabled: map.get("payments_enabled") === "true",
        shop_url: map.get("shop_url") ?? "",
        shop_label: map.get("shop_label") || "RevMate shop",
        tiktok_pixel_id: map.get("tiktok_pixel_id") ?? "",
        android_package: map.get("android_package") ?? "",
        android_fingerprint: map.get("android_fingerprint") ?? "",
        ai_diagnosis_enabled: map.get("ai_diagnosis_enabled") === "true",
        store_enabled: map.get("store_enabled") === "true",
        store_free_delivery_over: Number(map.get("store_free_delivery_over") ?? 0) || 0,
      };
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data ?? null;
}

/** True once the money SQL is live (admin tools appear). */
export function useMoneyFeature(): boolean {
  return useMoneySettings() !== null;
}

/** True when members can buy things. */
export function usePaymentsEnabled(): boolean {
  return useMoneySettings()?.payments_enabled === true;
}

export async function saveSetting(
  key: keyof MoneySettings | "ai_daily_cap" | "ai_user_daily_cap",
  value: string,
) {
  const { error } = await db
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// ---------- Products ----------

export type PaidProduct = {
  code: string;
  name: string;
  description: string;
  kind: "listing_feature" | "plus" | "business_pro";
  billing: "one_off" | "monthly";
  price_pence: number;
  founding_price_pence: number | null;
  feature_days: number | null;
  active: boolean;
  sort_order: number;
};

export function formatPence(pence: number) {
  return `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;
}

export function useProducts() {
  const { data } = useQuery({
    queryKey: ["paid-products"],
    queryFn: fetchProducts,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data ?? [];
}

export async function fetchProducts(): Promise<PaidProduct[]> {
  const { data, error } = await db.from("paid_products").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return data as PaidProduct[];
}

export async function updateProduct(
  code: string,
  patch: Partial<
    Pick<PaidProduct, "name" | "description" | "price_pence" | "founding_price_pence" | "active">
  >,
) {
  const { error } = await db.from("paid_products").update(patch).eq("code", code);
  if (error) throw new Error(error.message);
}

// ---------- Buying ----------

async function invoke(fn: string, body: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(fn, {
    body,
  });
  if (error) {
    // The function's own message (e.g. "You already have this") is in the response body.
    const context = (error as { context?: Response }).context;
    const detail = context
      ? await context
          .json()
          .then((b: { error?: string }) => b.error)
          .catch(() => null)
      : null;
    throw new Error(detail ?? "Couldn't reach payments. Try again.");
  }
  if (!data?.url) throw new Error(data?.error ?? "Couldn't open the payment page.");
  return data.url;
}

/** Sends the member to Stripe to pay. Comes back to returnPath?paid=1. */
export async function startCheckout(product: string, returnPath: string, targetId?: string) {
  const url = await invoke("create-checkout", {
    product,
    target_id: targetId,
    return_path: returnPath,
  });
  window.location.assign(url);
}

/** Stripe's page for cancelling plans, changing cards and receipts. */
export async function openBillingPortal(returnPath = "/settings") {
  const url = await invoke("billing-portal", { return_path: returnPath });
  window.location.assign(url);
}

// ---------- My plan ----------

export type Subscription = {
  stripe_subscription_id: string;
  product_code: string;
  target_id: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export type Payment = {
  id: string;
  user_id: string | null;
  product_code: string;
  target_id: string | null;
  amount_pence: number;
  status: "paid" | "refunded";
  created_at: string;
};

const LIVE = ["active", "trialing", "past_due"];

export function isLive(sub: Pick<Subscription, "status">) {
  return LIVE.includes(sub.status);
}

/** The signed-in member's subscriptions and payments. */
export function useMyBilling() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-billing", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [subs, pays] = await Promise.all([
        db.from("subscriptions").select("*").eq("user_id", user!.id),
        db
          .from("payments")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (subs.error || pays.error) return null;
      return { subscriptions: subs.data as Subscription[], payments: pays.data as Payment[] };
    },
    retry: false,
  });
  return data ?? null;
}

/** Whether someone has RevMate Plus (false until the SQL has run). */
export function usePlusMember(userId: string | null | undefined): boolean {
  const { data } = useQuery({
    queryKey: ["plus-member", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db.rpc("is_plus_member", { uid: userId });
      return !error && data === true;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data === true;
}

/** True when the signed-in member has Plus, so ads and deals are hidden. */
export function useAdFree(): boolean {
  const { user } = useAuth();
  return usePlusMember(user?.id);
}

// ---------- Deals ----------

export type DealPlacement = "essentials" | "ev_chargers" | "fuel" | "marketplace";

export const DEAL_PLACEMENTS: { value: DealPlacement; label: string }[] = [
  { value: "essentials", label: "Essentials" },
  { value: "ev_chargers", label: "EV chargers" },
  { value: "fuel", label: "Fuel prices" },
  { value: "marketplace", label: "Buy & Sell" },
];

export type Deal = {
  id: string;
  placement: DealPlacement;
  partner: string;
  title: string;
  blurb: string;
  url: string;
  cta: string;
  image_url: string | null;
  active: boolean;
  sort_order: number;
  clicks: number;
};

export function useDeals(placement: DealPlacement): Deal[] {
  const { data } = useQuery({
    queryKey: ["deals", placement],
    queryFn: async () => {
      const { data, error } = await db
        .from("affiliate_deals")
        .select("*")
        .eq("placement", placement)
        .eq("active", true)
        .order("sort_order");
      return error ? [] : (data as Deal[]);
    },
    staleTime: 10 * 60_000,
    retry: false,
  });
  return data ?? [];
}

export function recordDealClick(id: string) {
  // Supabase only sends the request once something waits on it.
  void db.rpc("record_deal_click", { deal_id: id }).then(() => undefined);
}

export async function fetchAllDeals(): Promise<Deal[]> {
  const { data, error } = await db
    .from("affiliate_deals")
    .select("*")
    .order("placement")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data as Deal[];
}

export type DealInput = Omit<Deal, "id" | "clicks">;

export async function saveDeal(id: string | null, input: DealInput) {
  const { error } = id
    ? await db.from("affiliate_deals").update(input).eq("id", id)
    : await db.from("affiliate_deals").insert(input);
  if (error) throw new Error(error.message);
}

export async function deleteDeal(id: string) {
  const { error } = await db.from("affiliate_deals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Admin ----------

export type MoneyStats = {
  revenue_month_pence: number;
  revenue_30d_pence: number;
  revenue_all_pence: number;
  plus_members: number;
  business_pro: number;
  featured_now: number;
  deal_clicks: number;
};

export async function fetchMoneyStats(): Promise<MoneyStats> {
  const { data, error } = await db.rpc("admin_money_stats");
  if (error) throw new Error(error.message);
  return data as MoneyStats;
}

export async function fetchRecentPayments(): Promise<(Payment & { username: string | null })[]> {
  const { data, error } = await db
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = data as Payment[];
  const ids = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v))];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("user_id, username").in("user_id", ids)
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.user_id, p.username]));
  return rows.map((r) => ({ ...r, username: r.user_id ? (names.get(r.user_id) ?? null) : null }));
}

// ---------- Challenge sponsors ----------

export type Sponsorship = {
  sponsor_name: string | null;
  sponsor_url: string | null;
  prize: string | null;
};

export async function saveSponsorship(challengeId: string, s: Sponsorship) {
  const { error } = await db.from("challenges").update(s).eq("id", challengeId);
  if (error) throw new Error(error.message);
}
