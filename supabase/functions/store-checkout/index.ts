// RevMate Store checkout: prices the basket from the database, creates a
// pending order and opens Stripe Checkout with UK delivery address
// collection. The stripe-webhook function marks the order paid.
//
//   POST { items: [{ product_id, qty }] }  (signed-in members only) → { url }
//
// Secrets: STRIPE_SECRET_KEY. Optional: APP_URL.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const appUrl = (Deno.env.get("APP_URL") ?? "https://revmate.co.uk").replace(/\/+$/, "");

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeOrigin(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  try {
    const host = new URL(origin).hostname;
    if (
      host === "revmate.co.uk" ||
      host.endsWith(".revmate.co.uk") ||
      host.endsWith(".lovable.app") ||
      host.endsWith(".lovableproject.com") ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      origin === appUrl
    ) {
      return origin.replace(/\/+$/, "");
    }
  } catch {
    // fall through
  }
  return appUrl;
}

type Line = { product_id: string; title: string; qty: number; price_pence: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!stripeKey) return json({ error: "The store isn't open yet." }, 503);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "Log in to check out." }, 401);

  const { data: settings } = await admin
    .from("app_settings")
    .select("key, value")
    .in("key", ["payments_enabled", "store_enabled"]);
  const on = new Map((settings ?? []).map((r) => [r.key, r.value]));
  if (on.get("payments_enabled") !== "true" || on.get("store_enabled") !== "true") {
    return json({ error: "The store isn't open yet." }, 503);
  }

  let items: unknown;
  try {
    items = (await req.json())?.items;
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (!Array.isArray(items)) return json({ error: "Your basket is empty." }, 400);
  const clean = items
    .filter(
      (i): i is { product_id: string; qty: number } =>
        !!i &&
        typeof i.product_id === "string" &&
        /^[0-9a-f-]{36}$/i.test(i.product_id) &&
        Number.isInteger(i.qty),
    )
    .slice(0, 20);

  const { data: order, error } = await admin.rpc("store_create_order", {
    p_user: user.id,
    p_items: clean,
  });
  if (error) {
    // Friendly messages come straight from the database (out of stock etc.).
    return json({ error: error.message || "Couldn't start checkout." }, 400);
  }
  const o = order as {
    order_id: string;
    items: Line[];
    delivery_pence: number;
  };

  const origin = safeOrigin(req);
  const params = new URLSearchParams({
    mode: "payment",
    client_reference_id: user.id,
    customer_email: user.email ?? "",
    success_url: `${origin}/orders?paid=1`,
    cancel_url: `${origin}/basket`,
    "shipping_address_collection[allowed_countries][0]": "GB",
    "phone_number_collection[enabled]": "true",
    "metadata[order_id]": o.order_id,
    "metadata[user_id]": user.id,
    "payment_intent_data[metadata][order_id]": o.order_id,
    "shipping_options[0][shipping_rate_data][type]": "fixed_amount",
    "shipping_options[0][shipping_rate_data][fixed_amount][amount]": String(o.delivery_pence),
    "shipping_options[0][shipping_rate_data][fixed_amount][currency]": "gbp",
    "shipping_options[0][shipping_rate_data][display_name]":
      o.delivery_pence === 0 ? "Free UK delivery" : "UK delivery",
  });
  o.items.forEach((line, i) => {
    params.set(`line_items[${i}][quantity]`, String(line.qty));
    params.set(`line_items[${i}][price_data][currency]`, "gbp");
    params.set(`line_items[${i}][price_data][unit_amount]`, String(line.price_pence));
    params.set(`line_items[${i}][price_data][product_data][name]`, line.title);
  });
  if (!user.email) params.delete("customer_email");

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const session = await res.json();
  if (!res.ok) {
    console.error("store-checkout", session?.error?.message);
    return json({ error: "Couldn't open the payment page. Try again." }, 502);
  }
  await admin.rpc("store_attach_session", { p_order: o.order_id, p_session: session.id });
  return json({ url: session.url });
});
