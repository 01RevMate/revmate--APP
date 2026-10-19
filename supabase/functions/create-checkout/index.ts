// Opens a Stripe Checkout page for something a member wants to buy.
//
//   POST { product, target_id?, return_path? }  (signed-in members only)
//   → { url } of the Stripe page to send them to.
//
// The price always comes from public.paid_products, never from the app, and
// the member must own the listing or business they're paying for. What was
// bought is recorded later by the stripe-webhook function.
//
// Secrets: STRIPE_SECRET_KEY. Optional: APP_URL (defaults to
// https://revmate.co.uk), used when the request's origin isn't a known
// RevMate address.
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

/** Calls the Stripe API with a form-encoded body. */
async function stripe(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`);
  return data;
}

/** Only send people back to RevMate itself (or a Lovable preview). */
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!stripeKey) return json({ error: "Payments aren't set up yet." }, 503);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "Please log in first." }, 401);

  let body: { product?: string; target_id?: string; return_path?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const { data: setting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "payments_enabled")
    .maybeSingle();
  if (setting?.value !== "true") return json({ error: "Payments are switched off." }, 503);

  const { data: product } = await admin
    .from("paid_products")
    .select("*")
    .eq("code", body.product ?? "")
    .eq("active", true)
    .maybeSingle();
  if (!product) return json({ error: "That isn't available." }, 404);

  const targetId = typeof body.target_id === "string" ? body.target_id : null;

  if (product.kind === "listing_feature") {
    const { data: listing } = await admin
      .from("listings")
      .select("id, user_id, status")
      .eq("id", targetId ?? "")
      .maybeSingle();
    if (!listing || listing.user_id !== user.id || listing.status !== "active") {
      return json({ error: "You can only feature your own live listings." }, 403);
    }
  } else if (product.kind === "business_pro") {
    const { data: business } = await admin
      .from("businesses")
      .select("id, owner_user_id, status")
      .eq("id", targetId ?? "")
      .maybeSingle();
    if (!business || business.owner_user_id !== user.id || business.status !== "active") {
      return json({ error: "Only the owner of a listed business can go Pro." }, 403);
    }
  }

  // No paying twice for the same plan.
  if (product.billing === "monthly") {
    let q = admin
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .eq("product_code", product.code)
      .in("status", ["active", "trialing", "past_due"]);
    if (targetId) q = q.eq("target_id", targetId);
    const { data: existing } = await q.limit(1);
    if (existing && existing.length > 0) {
      return json({ error: "You already have this. Manage it in Settings." }, 409);
    }
  }

  let price = product.price_pence as number;
  if (product.founding_price_pence) {
    const { data: founding } = await admin
      .from("founding_members")
      .select("number")
      .eq("user_id", user.id)
      .maybeSingle();
    if (founding) price = product.founding_price_pence;
  }

  try {
    // One Stripe customer per member, so they can manage everything in one place.
    const { data: saved } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    let customer = saved?.stripe_customer_id as string | undefined;
    if (!customer) {
      const created = await stripe("customers", {
        email: user.email ?? "",
        "metadata[user_id]": user.id,
      });
      customer = created.id as string;
      await admin.rpc("billing_save_customer", { p_user: user.id, p_customer: customer });
    }

    const origin = safeOrigin(req);
    const returnPath =
      typeof body.return_path === "string" && /^\/[A-Za-z0-9/_\-.?=&]*$/.test(body.return_path)
        ? body.return_path
        : "/settings";
    const sep = returnPath.includes("?") ? "&" : "?";
    const meta = { user_id: user.id, product: product.code, target_id: targetId ?? "" };

    const params: Record<string, string> = {
      mode: product.billing === "monthly" ? "subscription" : "payment",
      customer,
      client_reference_id: user.id,
      success_url: `${origin}${returnPath}${sep}paid=1`,
      cancel_url: `${origin}${returnPath}`,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "gbp",
      "line_items[0][price_data][unit_amount]": String(price),
      "line_items[0][price_data][product_data][name]": product.name,
      allow_promotion_codes: "true",
    };
    if (product.description) {
      params["line_items[0][price_data][product_data][description]"] = product.description;
    }
    if (product.billing === "monthly") {
      params["line_items[0][price_data][recurring][interval]"] = "month";
    }
    for (const [k, v] of Object.entries(meta)) {
      params[`metadata[${k}]`] = v;
      if (product.billing === "monthly") params[`subscription_data[metadata][${k}]`] = v;
      else params[`payment_intent_data[metadata][${k}]`] = v;
    }

    const session = await stripe("checkout/sessions", params);
    return json({ url: session.url });
  } catch (err) {
    console.error("create-checkout", err);
    return json({ error: "Couldn't open the payment page. Try again." }, 502);
  }
});
