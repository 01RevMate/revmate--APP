import { supabase } from "@/integrations/supabase/client";

// Phone push notifications (Web Push). On iPhone this only works once
// RevMate has been added to the Home Screen (iOS 16.4+); Android and
// desktop browsers work straight from the browser.

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iPhone/iPad Safari that hasn't been added to the Home Screen yet. */
export function needsHomeScreenInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function getRegistration() {
  return navigator.serviceWorker.register("/sw.js");
}

export async function isPushEnabledOnThisDevice(): Promise<boolean> {
  if (!isPushSupported() || Notification.permission !== "granted") return false;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  return !!(await registration?.pushManager.getSubscription());
}

export async function enablePush(userId: string) {
  if (!isPushSupported()) throw new Error("This browser doesn't support push notifications.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications are blocked — allow them for RevMate in your phone's settings.");
  }
  const { data, error } = await supabase.functions.invoke<{ publicKey?: string }>("send-push", {
    method: "GET",
  });
  if (error || !data?.publicKey) {
    throw new Error("Phone notifications aren't switched on for RevMate yet.");
  }
  const registration = await getRegistration();
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(data.publicKey),
    }));
  const json = subscription.toJSON();
  const { error: saveError } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.["p256dh"] ?? "",
      auth: json.keys?.["auth"] ?? "",
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: "endpoint" },
  );
  if (saveError) throw saveError;
}

export async function disablePush() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}
