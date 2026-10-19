import { looseDb } from "@/lib/looseDb";
import { detectInAppBrowser } from "@/lib/inAppBrowser";

// Where a visitor came from (a TikTok post, an ad…), so we can see which
// campaigns work. Kept in memory only (nothing stored on the device) and
// sent with the sign-up form if they join. Campaign visits are counted in
// the database with no personal data at all.

export type Attribution = {
  campaign: string | null;
  source: string | null;
  medium: string | null;
  landing: string;
};

let current: Attribution | null = null;
const counted = new Set<string>();

const clean = (v: string | null) => {
  const s = v?.trim().toLowerCase() ?? "";
  return /^[a-z0-9_.-]{1,40}$/.test(s) ? s : null;
};

function referrerSource(): string | null {
  const app = detectInAppBrowser();
  if (app) return app;
  try {
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    if (!host || host === window.location.hostname) return null;
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("instagram")) return "instagram";
    if (host.includes("facebook")) return "facebook";
    if (host.includes("google")) return "google";
    return clean(host.split(".").slice(-2, -1)[0] ?? null);
  } catch {
    return null;
  }
}

/** Reads ?utm_… from the first page someone opens. Call once on load. */
export function captureAttribution() {
  if (current || typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const p = url.searchParams;
  const goCampaign = /^\/go\/([a-z0-9_-]{1,40})\/?$/.exec(url.pathname)?.[1] ?? null;
  current = {
    campaign: clean(p.get("utm_campaign")) ?? goCampaign,
    source: clean(p.get("utm_source")) ?? (p.has("ttclid") ? "tiktok" : referrerSource()),
    medium: clean(p.get("utm_medium")) ?? (p.has("ttclid") ? "paid" : null),
    landing: url.pathname.slice(0, 100),
  };
  if (current.campaign) countVisit(current.campaign, current.source);
}

export function getAttribution(): Attribution | null {
  return current;
}

/** Counts a campaign visit (once per page load per campaign). */
export function countVisit(campaign: string, source: string | null) {
  const key = `${campaign}:${source}`;
  if (counted.has(key)) return;
  counted.add(key);
  // Supabase only sends the request once something waits on it.
  void looseDb
    .rpc("record_campaign_visit", { p_campaign: campaign, p_source: source ?? "direct" })
    .then(() => undefined);
}
