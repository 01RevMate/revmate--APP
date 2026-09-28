import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

const CONSENT_KEY = "revmate:maps-consent";

/**
 * Google Maps can set its own cookies, so under UK cookie rules (PECR) it
 * only loads once someone taps to show it. "Always show maps" remembers the
 * choice on this device; it can be cleared in Settings → Privacy.
 */
export function MapEmbed({ src, title }: { src: string; title: string }) {
  const [allowed, setAllowed] = useState(false);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    try {
      setAllowed(localStorage.getItem(CONSENT_KEY) === "yes");
    } catch {
      // Storage unavailable: just ask each time.
    }
  }, []);

  if (allowed) {
    return (
      <iframe
        title={title}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="aspect-[16/10] w-full rounded-md border border-border"
      />
    );
  }
  return (
    <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted/40 p-4 text-center">
      <MapPin className="size-6 text-muted-foreground" />
      <p className="max-w-xs text-xs text-muted-foreground">
        The map is provided by Google, which may set cookies and see your IP address.
      </p>
      <button
        type="button"
        onClick={() => {
          if (remember) {
            try {
              localStorage.setItem(CONSENT_KEY, "yes");
            } catch {
              // Not remembered; still show it now.
            }
          }
          setAllowed(true);
        }}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
      >
        Show map
      </button>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="accent-primary"
        />
        Always show maps on this device
      </label>
    </div>
  );
}

export function forgetMapsConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Nothing stored.
  }
}
