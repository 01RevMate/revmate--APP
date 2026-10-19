import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useAccountAge } from "@/lib/legal";
import { useMoneySettings } from "@/lib/money";
import { isValidPixelId, loadPixel, trackPageView, useAdsConsent } from "@/lib/tiktokPixel";

/**
 * Asks once whether TikTok ad cookies are OK, then loads the TikTok Pixel
 * only if the answer is yes. Shows nothing until an admin adds a Pixel ID,
 * and never runs for signed-in under-18s.
 */
export function AdsConsent() {
  const settings = useMoneySettings();
  const [consent, setConsent] = useAdsConsent();
  const age = useAccountAge();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastPath = useRef<string | null>(null);

  const pixelId = settings?.tiktok_pixel_id ?? "";
  const minor = age !== null && age < 18;
  const active = isValidPixelId(pixelId) && !minor;

  useEffect(() => {
    if (!active || consent !== "yes") return;
    if (lastPath.current === null) {
      loadPixel(pixelId); // also records this first page view
    } else if (lastPath.current !== pathname) {
      trackPageView();
    }
    lastPath.current = pathname;
  }, [active, consent, pixelId, pathname]);

  if (!active || consent !== null || pathname.startsWith("/admin")) return null;

  return (
    <div
      role="dialog"
      aria-label="Ad cookies"
      className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md rounded-2xl border border-border bg-background p-4 shadow-2xl md:bottom-4"
    >
      <p className="text-sm font-semibold">Can we use TikTok ad cookies?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        They tell us which of our TikTok ads bring people to RevMate, so we can grow. Saying no
        changes nothing in the app.{" "}
        <Link to="/legal/cookies" className="underline">
          Cookie policy
        </Link>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setConsent("no")}
          className="min-h-11 rounded-xl border border-input text-sm font-semibold"
        >
          No thanks
        </button>
        <button
          type="button"
          onClick={() => setConsent("yes")}
          className="min-h-11 rounded-xl border border-input text-sm font-semibold"
        >
          Allow
        </button>
      </div>
    </div>
  );
}

/** Settings → Privacy: change the ad cookies answer any time. */
export function AdsConsentSetting() {
  const settings = useMoneySettings();
  const [consent, setConsent] = useAdsConsent();
  if (!isValidPixelId(settings?.tiktok_pixel_id ?? "")) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div>
        <p className="text-sm font-semibold">TikTok ad cookies</p>
        <p className="text-xs text-muted-foreground">
          {consent === "yes" ? "Allowed on this device" : "Off on this device"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setConsent(consent === "yes" ? "no" : "yes")}
        className="min-h-10 rounded-lg border border-input px-3 text-sm font-semibold"
      >
        {consent === "yes" ? "Turn off" : "Allow"}
      </button>
    </div>
  );
}
