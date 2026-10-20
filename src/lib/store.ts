import { useCallback, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { looseDb as db } from "@/lib/looseDb";
import { useMoneySettings } from "@/lib/money";

// RevMate Store (0067): car products RevMate sells and delivers (drop-shipped
// or sent by a UK partner). Payment via the store-checkout edge function and
// Stripe Checkout. The basket lives on the device only.

export type StoreProduct = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  description: string;
  images: string[];
  category: string;
  price_pence: number;
  was_price_pence: number | null;
  delivery_pence: number;
  delivery_estimate: string;
  fulfilment: "dropship" | "partner" | "revmate";
  stock: number | null;
  fits_makes: string[];
  active: boolean;
  sort_order: number;
  sold_count: number;
};

export type StoreOrder = {
  id: string;
  user_id: string | null;
  status:
    "pending_payment" | "paid" | "ordered" | "shipped" | "delivered" | "cancelled" | "refunded";
  items: { product_id: string; title: string; qty: number; price_pence: number }[];
  subtotal_pence: number;
  delivery_pence: number;
  total_pence: number;
  shipping_name: string | null;
  shipping_address: Record<string, string | null> | null;
  email: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  admin_note: string;
  paid_at: string | null;
  created_at: string;
};

export const ORDER_STATUS_LABEL: Record<StoreOrder["status"], string> = {
  pending_payment: "Awaiting payment",
  paid: "Confirmed",
  ordered: "Being prepared",
  shipped: "On its way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** True when the store is switched on and payments work. */
export function useStoreOpen(): boolean {
  const s = useMoneySettings();
  return !!s?.payments_enabled && !!s?.store_enabled;
}

export function useStoreProducts(category?: string) {
  return useQuery({
    queryKey: ["store", "products", category ?? ""],
    queryFn: async () => {
      let q = db.from("store_products").select("*").eq("active", true).order("sort_order");
      if (category) q = q.eq("category", category);
      const { data, error } = await q.limit(200);
      if (error) throw new Error(error.message);
      return data as StoreProduct[];
    },
    retry: false,
  });
}

export async function fetchStoreProduct(slug: string): Promise<StoreProduct | null> {
  const { data, error } = await db
    .from("store_products")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StoreProduct | null) ?? null;
}

export async function fetchStoreProductsByIds(ids: string[]): Promise<StoreProduct[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from("store_products").select("*").in("id", ids);
  if (error) throw new Error(error.message);
  return data as StoreProduct[];
}

// ---------- Basket (device only) ----------

export type BasketLine = { product_id: string; qty: number };

const BASKET_KEY = "revmate:basket";
const BASKET_EVENT = "revmate:basketChange";
let memoryBasket: BasketLine[] = [];
let cachedRaw: string | null = null;
let cachedBasket: BasketLine[] = [];

function readBasket(): BasketLine[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(BASKET_KEY);
  } catch {
    return memoryBasket;
  }
  if (raw === cachedRaw) return cachedBasket;
  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw ?? "[]") as BasketLine[];
    cachedBasket = Array.isArray(parsed)
      ? parsed.filter(
          (l) => typeof l.product_id === "string" && Number.isInteger(l.qty) && l.qty > 0,
        )
      : [];
  } catch {
    cachedBasket = [];
  }
  return cachedBasket;
}

function writeBasket(lines: BasketLine[]) {
  memoryBasket = lines;
  try {
    localStorage.setItem(BASKET_KEY, JSON.stringify(lines));
  } catch {
    // Private browsing: kept in memory for this visit.
  }
  window.dispatchEvent(new Event(BASKET_EVENT));
}

function subscribeBasket(cb: () => void) {
  window.addEventListener(BASKET_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(BASKET_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

const EMPTY: BasketLine[] = [];

export function useBasket() {
  const lines = useSyncExternalStore(subscribeBasket, readBasket, () => EMPTY);
  const add = useCallback((productId: string, qty = 1) => {
    const current = readBasket();
    const found = current.find((l) => l.product_id === productId);
    writeBasket(
      found
        ? current.map((l) =>
            l.product_id === productId ? { ...l, qty: Math.min(10, l.qty + qty) } : l,
          )
        : [...current, { product_id: productId, qty: Math.min(10, qty) }].slice(0, 20),
    );
  }, []);
  const setQty = useCallback((productId: string, qty: number) => {
    const current = readBasket();
    writeBasket(
      qty <= 0
        ? current.filter((l) => l.product_id !== productId)
        : current.map((l) => (l.product_id === productId ? { ...l, qty: Math.min(10, qty) } : l)),
    );
  }, []);
  const clear = useCallback(() => writeBasket([]), []);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  return { lines, count, add, setQty, clear };
}

export async function startStoreCheckout(items: BasketLine[]) {
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
    "store-checkout",
    { body: { items } },
  );
  if (error) {
    const context = (error as { context?: Response }).context;
    const detail = context
      ? await context
          .json()
          .then((b: { error?: string }) => b.error)
          .catch(() => null)
      : null;
    throw new Error(detail ?? "Couldn't start checkout. Try again.");
  }
  if (!data?.url) throw new Error(data?.error ?? "Couldn't start checkout.");
  window.location.assign(data.url);
}

export async function fetchMyOrders(userId: string): Promise<StoreOrder[]> {
  const { data, error } = await db
    .from("store_orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data as StoreOrder[];
}

// ---------- Admin ----------

export type ProductEdit = Omit<StoreProduct, "id" | "sold_count">;
export type SupplierInfo = {
  supplier: string;
  supplier_url: string | null;
  supplier_sku: string;
  cost_pence: number | null;
  notes: string;
};

export async function fetchAllStoreProducts(): Promise<StoreProduct[]> {
  const { data, error } = await db
    .from("store_products")
    .select("*")
    .order("sort_order")
    .limit(500);
  if (error) throw new Error(error.message);
  return data as StoreProduct[];
}

export async function fetchSupplier(productId: string): Promise<SupplierInfo | null> {
  const { data } = await db
    .from("store_suppliers")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();
  return (data as SupplierInfo | null) ?? null;
}

export async function saveStoreProduct(
  id: string | null,
  product: ProductEdit,
  supplier: SupplierInfo,
): Promise<void> {
  let productId = id;
  if (id) {
    const { slug: _slug, ...rest } = product;
    const { error } = await db.from("store_products").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await db
      .from("store_products")
      .insert(product)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    productId = (data as { id: string }).id;
  }
  const { error: sErr } = await db
    .from("store_suppliers")
    .upsert({ product_id: productId, ...supplier });
  if (sErr) throw new Error(sErr.message);
}

export async function deleteStoreProduct(id: string) {
  const { error } = await db.from("store_products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchAllOrders(): Promise<StoreOrder[]> {
  const { data, error } = await db
    .from("store_orders")
    .select("*")
    .neq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data as StoreOrder[];
}

export async function updateOrder(
  id: string,
  patch: Partial<
    Pick<
      StoreOrder,
      "status" | "tracking_carrier" | "tracking_number" | "tracking_url" | "admin_note"
    >
  >,
) {
  const { error } = await db.from("store_orders").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
