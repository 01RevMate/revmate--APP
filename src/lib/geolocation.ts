import { detectInAppBrowser, IN_APP_NAMES } from "@/lib/inAppBrowser";
import { isIosDevice } from "@/lib/pwaInstall";

// "Use my location" for fuel prices and EV chargers. The position stays on the
// phone (see docs/LOCATION_PRIVACY.md); it's only used to sort nearby places.
//
// Phones are slow to get a precise GPS fix, especially indoors, so we ask for a
// quick rough position first (Wi-Fi / mobile masts, usually under a second) and
// only wait for GPS if that fails. A recent answer is reused for a few minutes
// so moving between pages doesn't ask again.

export type Coords = { lat: number; lng: number };

export type LocationProblem = {
  kind: "denied" | "timeout" | "unavailable" | "unsupported" | "preview";
  title: string;
  help: string;
};

let cached: { coords: Coords; at: number } | null = null;
const REUSE_MS = 5 * 60_000;

function attempt(options: PositionOptions): Promise<Coords> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      options,
    );
  });
}

/** True inside another site's frame (e.g. the Lovable editor preview). */
function inFrame() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function deniedHelp(): string {
  const app = detectInAppBrowser();
  if (app) {
    return `${IN_APP_NAMES[app]}'s browser may block location. Tap ••• then "Open in browser", or search a postcode or town.`;
  }
  if (isIosDevice()) {
    return "On iPhone: Settings → Privacy & Security → Location Services → turn it on, then Safari Websites → While Using the App. Then try again, or search a postcode or town.";
  }
  return "Tap the icon next to the web address → Permissions (or Site settings) → Location → Allow. Also check location is on in your phone's quick settings. Or search a postcode or town.";
}

export function describeLocationError(err: unknown): LocationProblem {
  if (err && typeof err === "object" && "kind" in err) return err as LocationProblem;
  const code = (err as GeolocationPositionError | null)?.code;
  if (code === 1) {
    if (inFrame()) {
      return {
        kind: "preview",
        title: "Location doesn't work in this preview",
        help: "Open revmate.co.uk in your browser to use your location, or search a postcode or town.",
      };
    }
    return { kind: "denied", title: "RevMate can't see your location", help: deniedHelp() };
  }
  if (code === 3) {
    return {
      kind: "timeout",
      title: "Couldn't find you in time",
      help: "Your phone took too long to get a signal. Try again (it's often quicker near a window), or search a postcode or town.",
    };
  }
  return {
    kind: "unavailable",
    title: "Your location isn't available right now",
    help: "Check location is switched on for your phone, or search a postcode or town.",
  };
}

/**
 * Finds the phone's position: quick rough fix first, then GPS. Rejects with a
 * LocationProblem explaining what to do.
 */
export async function getMyLocation(): Promise<Coords> {
  if (cached && Date.now() - cached.at < REUSE_MS) return cached.coords;
  if (typeof navigator === "undefined" || !navigator.geolocation || !window.isSecureContext) {
    throw {
      kind: "unsupported",
      title: "Location isn't available on this device",
      help: "Search a postcode or town instead.",
    } satisfies LocationProblem;
  }
  let coords: Coords;
  try {
    coords = await attempt({ enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60_000 });
  } catch (err) {
    // Saying no won't change on a second try; anything else might.
    if ((err as GeolocationPositionError).code === 1) throw describeLocationError(err);
    try {
      coords = await attempt({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    } catch (err2) {
      throw describeLocationError(err2);
    }
  }
  cached = { coords, at: Date.now() };
  return coords;
}
