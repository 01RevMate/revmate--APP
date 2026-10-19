import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { detectInAppBrowser, IN_APP_NAMES, type InAppBrowser } from "@/lib/inAppBrowser";

/** In TikTok's (or Instagram's) built-in browser: how to open RevMate properly. */
export function InAppBrowserTip() {
  const [app, setApp] = useState<InAppBrowser>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => setApp(detectInAppBrowser()), []);
  if (!app || hidden) return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-sky-500/10 p-3 text-sm">
      <ExternalLink className="mt-0.5 size-4 shrink-0 text-sky-600" />
      <p className="flex-1">
        You're in {IN_APP_NAMES[app]}'s browser. Everything works here, but to add RevMate to your
        home screen tap <strong>•••</strong> then <strong>Open in browser</strong>.
      </p>
      <button type="button" aria-label="Hide tip" onClick={() => setHidden(true)}>
        <X className="size-4 text-muted-foreground" />
      </button>
    </div>
  );
}
