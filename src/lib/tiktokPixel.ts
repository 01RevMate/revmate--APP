import { useCallback, useSyncExternalStore } from "react";

// TikTok Pixel, so TikTok can tell us which ads lead to sign-ups. It only
// loads after someone taps "Allow" on the ad cookies question (UK PECR), never
// for under-18s, and never until an admin has added a Pixel ID.

type Ttq = {
  page: () => void;
  track: (event: string, props?: Record<string, unknown>) => void;
  load: (id: string) => void;
};

declare global {
  interface Window {
    ttq?: Ttq;
    TiktokAnalyticsObject?: string;
  }
}

export type AdsConsent = "yes" | "no" | null;

const KEY = "revmate:ads-consent";
const EVENT = "revmate:adsConsentChange";
let memory: AdsConsent = null;
let loadedId: string | null = null;

function read(): AdsConsent {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "yes" || v === "no") return v;
  } catch {
    // fall through
  }
  return memory;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useAdsConsent(): [AdsConsent, (v: "yes" | "no") => void] {
  const value = useSyncExternalStore(subscribe, read, () => null);
  const set = useCallback((v: "yes" | "no") => {
    memory = v;
    try {
      // Remembering the answer itself is strictly necessary, so allowed.
      localStorage.setItem(KEY, v);
    } catch {
      // private browsing: remembered for this visit only
    }
    window.dispatchEvent(new Event(EVENT));
    // Withdrawing consent: reload so the pixel's script is gone.
    if (v === "no" && loadedId) window.location.reload();
  }, []);
  return [value, set];
}

export const isValidPixelId = (id: string) => /^[A-Z0-9]{10,30}$/.test(id);

// TikTok's official base code (Events Manager → Pixel → manual setup),
// with the ID passed in. Runs only after consent.
const BASE_CODE = `!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
  ttq.load(PIXEL_ID);
  ttq.page();
}(window, document, 'ttq');`;

/** Loads the pixel once. The ID is checked to be letters and digits only. */
export function loadPixel(id: string) {
  if (loadedId || typeof window === "undefined" || !isValidPixelId(id)) return;
  loadedId = id;
  const script = document.createElement("script");
  script.text = BASE_CODE.replace("PIXEL_ID", JSON.stringify(id));
  document.head.appendChild(script);
}

export function pixelLoaded() {
  return loadedId !== null;
}

/** Sends an event (e.g. CompleteRegistration) if the pixel is running. */
export function trackAdEvent(event: string, props?: Record<string, unknown>) {
  if (loadedId) window.ttq?.track(event, props);
}

export function trackPageView() {
  if (loadedId) window.ttq?.page();
}
