// Opens Stripe's billing page, where members cancel plans, change cards and
// download receipts.
//
//   POST { return_path? }  (signed-in members only) → { url }
//
// Secrets: STRIPE_SECRET_KEY. Optional: APP_URL. In Stripe, save the
// Customer portal settings once (Settings → Billing → Customer portal).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!stripeKey) return json({ error: "Payments aren't set up yet." }, 503);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "Please log in first." }, 401);

  const { data: saved } = await admin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!saved) return json({ error: "Nothing to manage yet." }, 404);

  let returnPath = "/settings";
  try {
    const body = await req.json();
    if (typeof body?.return_path === "string" && /^\/[A-Za-z0-9/_\-.]*$/.test(body.return_path)) {
      returnPath = body.return_path;
    }
  } catch {
    // no body is fine
  }

  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      customer: saved.stripe_customer_id,
      return_url: `${safeOrigin(req)}${returnPath}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("billing-portal", data?.error?.message);
    return json({ error: "Couldn't open billing. Try again." }, 502);
  }
  return json({ url: data.url });
});
