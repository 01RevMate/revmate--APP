// Sends RevMate notifications to people's phones via Web Push.
//
//   GET  → { publicKey } so the app can subscribe a device.
//   POST → called by the database trigger in 0032_push_notifications.sql
//          with { notification_id } and the x-push-secret header; looks the
//          notification up and pushes it to every device of its recipient.
//
// Secrets (set in the project's edge function secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com),
//   PUSH_WEBHOOK_SECRET (same value as the push_webhook_secret Vault secret).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@revmate.app";
const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";

if (publicKey && privateKey) webpush.setVapidDetails(subject, publicKey, privateKey);

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

// Same wording as the in-app notification centre.
function describe(kind: string, actor: string, message: string | null, group: string) {
  switch (kind) {
    case "comment":
      return `${actor} commented on your post`;
    case "like":
      return `${actor} liked your post`;
    case "message":
      return `${actor} ${message ?? "sent you a message"}`;
    case "friend_request":
      return `${actor} sent you a friend request`;
    case "friend_accepted":
      return `${actor} accepted your friend request`;
    case "profile_follow":
      return `${actor} started following you`;
    case "car_like":
      return `${actor} liked a car in your garage`;
    case "car_follow":
      return `${actor} started following your car`;
    case "answer":
      return `${actor} answered your question`;
    case "join_request":
      return `${actor} requested to join ${group}`;
    case "membership":
      return `${actor} ${message ?? "updated your membership in"} ${group}`;
    case "post_review":
      return `${actor} ${message ?? "reviewed your post in"} ${group}`;
    case "app_update":
      return message ?? "There is a new RevMate update";
    case "mention":
      return `${actor} mentioned you`;
    case "comment_reply":
      return `${actor} replied to your comment`;
    case "comment_like":
      return `${actor} liked your comment`;
    case "repost":
      return `${actor} reposted your post`;
    case "spotted":
      return `${actor} spotted your car`;
    case "meet_rsvp":
      return `${actor} ${message ?? "is going to your meet"}`;
    case "meet_reminder":
      return message ?? "A meet you're going to is coming up soon";
    case "car_of_week":
      return message ?? "Your car is Car of the Week!";
    case "weekly_recap":
      return message ?? "Your weekly recap is ready";
    case "rank_up":
      return message ?? "Your car moved up the rankings";
    case "challenge":
      return message ?? "You won a challenge!";
    default:
      return "You have a new RevMate notification";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return publicKey ? json({ publicKey }) : json({ error: "Push is not configured" }, 503);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!webhookSecret || req.headers.get("x-push-secret") !== webhookSecret) {
    return json({ error: "Unauthorised" }, 401);
  }
  if (!publicKey || !privateKey) return json({ error: "Push is not configured" }, 503);

  const { notification_id } = await req.json().catch(() => ({}));
  if (typeof notification_id !== "string") return json({ error: "notification_id required" }, 400);

  const { data: notification } = await admin
    .from("notifications")
    .select(
      "id, user_id, kind, message, action_url, actor:profiles!notifications_actor_id_fkey(username), community_groups(name)",
    )
    .eq("id", notification_id)
    .maybeSingle();
  if (!notification) return json({ sent: 0 });

  // Quiet hours (10pm–8am UK): leave it in the app, don't buzz the phone.
  const { data: settings } = await admin
    .from("notification_settings")
    .select("quiet_hours")
    .eq("user_id", notification.user_id)
    .maybeSingle();
  if (settings?.quiet_hours) {
    const ukHour = Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        hour12: false,
        timeZone: "Europe/London",
      }).format(new Date()),
    );
    if (ukHour >= 22 || ukHour < 8) return json({ sent: 0, reason: "quiet_hours" });
  }

  const actor = String(
    (notification.actor as { username?: string } | null)?.username ?? "A member",
  ).replace(/^@+/, "");
  const group = (notification.community_groups as { name?: string } | null)?.name ?? "the group";
  const payload = JSON.stringify({
    title: "RevMate",
    body: describe(notification.kind, actor, notification.message, group),
    url: notification.action_url ?? "/",
    tag: notification.id,
  });

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", notification.user_id);

  let sent = 0;
  await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 * 24 },
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // The device unsubscribed or the browser expired it — forget it.
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }),
  );
  return json({ sent });
});
