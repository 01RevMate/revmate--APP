// TikTok, Instagram, Facebook and Snapchat open links in their own built-in
// browser. RevMate works there, but it can't be installed to the home screen
// and some phone features (location, notifications) may be blocked, so we
// suggest opening it in the phone's real browser.

const IN_APP = /BytedanceWebview|musical_ly|TikTok|trill_|Instagram|FBAN|FBAV|FB_IAB|Snapchat/i;

export type InAppBrowser = "tiktok" | "instagram" | "facebook" | "snapchat" | null;

export function detectInAppBrowser(ua?: string): InAppBrowser {
  const agent = ua ?? (typeof navigator === "undefined" ? "" : navigator.userAgent);
  if (!IN_APP.test(agent)) return null;
  if (/BytedanceWebview|musical_ly|TikTok|trill_/i.test(agent)) return "tiktok";
  if (/Instagram/i.test(agent)) return "instagram";
  if (/Snapchat/i.test(agent)) return "snapchat";
  return "facebook";
}

export const IN_APP_NAMES: Record<NonNullable<InAppBrowser>, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  snapchat: "Snapchat",
};
