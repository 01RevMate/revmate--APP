// Stripe tells RevMate what was paid for. Point a Stripe webhook endpoint at
// this function with these events:
//   checkout.session.completed, invoice.paid, customer.subscription.created,
//   customer.subscription.updated, customer.subscription.deleted, charge.refunded
//
// Every request is checked against the Stripe-Signature header, then recorded
// through the service-role-only billing_* functions in 0064_money.sql (which
// ignore repeats, so Stripe retrying an event is harmless).
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (the endpoint's whsec_…).
import { createClient } from "npm:@supabase/supabase-js@2";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

// deno-lint-ignore no-explicit-any
type Obj = Record<string, any>;

const encoder = new TextEncoder();

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Stripe's scheme: HMAC-SHA256 of "<timestamp>.<raw body>", within 5 minutes. */
async function verify(payload: string, header: string) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  );
  const signatures = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  const timestamp = Number(parts["t"]);
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((s) => timingSafeEqual(s, expected));
}

async function stripeGet(path: string): Promise<Obj> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`);
  return data;
}

const uuidOrNull = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

async function rpc(fn: string, args: Obj) {
  const { error } = await admin.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
}

async function saveSubscription(sub: Obj) {
  const meta = sub.metadata ?? {};
  if (!meta.product) return; // Not one of ours.
  // Newer API versions moved the period end onto the subscription item.
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
  await rpc("billing_upsert_subscription", {
    p_subscription: sub.id,
    p_user: uuidOrNull(meta.user_id),
    p_product: meta.product,
    p_target: uuidOrNull(meta.target_id),
    p_status: sub.status,
    p_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    p_cancel_at_end: !!sub.cancel_at_period_end,
  });
}

async function handle(event: Obj) {
  const obj: Obj = event.data?.object ?? {};
  switch (event.type) {
    case "checkout.session.completed": {
      const meta = obj.metadata ?? {};
      if (!meta.product) return;
      if (obj.mode === "payment" && obj.payment_status === "paid") {
        await rpc("billing_record_payment", {
          p_user: uuidOrNull(meta.user_id),
          p_product: meta.product,
          p_target: uuidOrNull(meta.target_id),
          p_amount: obj.amount_total ?? 0,
          p_currency: obj.currency ?? "gbp",
          p_ref: obj.id,
          p_intent: typeof obj.payment_intent === "string" ? obj.payment_intent : null,
        });
      } else if (obj.mode === "subscription" && typeof obj.subscription === "string") {
        await saveSubscription(await stripeGet(`subscriptions/${obj.subscription}`));
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await saveSubscription(obj);
      return;
    case "invoice.paid": {
      const subId =
        (typeof obj.subscription === "string" && obj.subscription) ||
        obj.parent?.subscription_details?.subscription;
      if (!subId || !obj.amount_paid) return;
      let meta = obj.subscription_details?.metadata ?? obj.parent?.subscription_details?.metadata;
      if (!meta?.product) meta = (await stripeGet(`subscriptions/${subId}`)).metadata ?? {};
      if (!meta.product) return;
      await rpc("billing_record_payment", {
        p_user: uuidOrNull(meta.user_id),
        p_product: meta.product,
        p_target: uuidOrNull(meta.target_id),
        p_amount: obj.amount_paid,
        p_currency: obj.currency ?? "gbp",
        p_ref: obj.id,
        p_intent: typeof obj.payment_intent === "string" ? obj.payment_intent : null,
      });
      return;
    }
    case "charge.refunded":
      if (obj.refunded && typeof obj.payment_intent === "string") {
        await rpc("billing_mark_refunded", { p_intent: obj.payment_intent });
      }
      return;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!webhookSecret || !stripeKey) return new Response("Not configured", { status: 503 });

  const payload = await req.text();
  if (!(await verify(payload, req.headers.get("stripe-signature") ?? ""))) {
    return new Response("Bad signature", { status: 400 });
  }

  try {
    await handle(JSON.parse(payload));
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // A 500 makes Stripe retry later, which is what we want.
    console.error("stripe-webhook", err);
    return new Response("Error", { status: 500 });
  }
});
