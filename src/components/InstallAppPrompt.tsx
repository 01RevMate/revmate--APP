import { useCallback, useEffect, useState } from "react";
import { Download, Share, PlusSquare, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  dismissInstallPrompt,
  getDeferredInstallPrompt,
  installPromptDismissed,
  isAppInstalled,
  isIosDevice,
  subscribeInstallPrompt,
} from "@/lib/pwaInstall";
import { detectInAppBrowser, IN_APP_NAMES } from "@/lib/inAppBrowser";

export const OPEN_INSTALL_EVENT = "revmate:open-install";

export function openInstallPrompt() {
  window.dispatchEvent(new CustomEvent(OPEN_INSTALL_EVENT));
}

/**
 * The "Add to home screen" prompt. Auto-opens once for signed-in users who
 * haven't installed the app, and re-opens whenever something calls
 * openInstallPrompt() (e.g. the More menu's "Install the app" entry).
 */
export function InstallAppPrompt() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(true); // hidden until mounted (SSR-safe)
  const [, setPromptVersion] = useState(0);

  useEffect(() => subscribeInstallPrompt(() => setPromptVersion((v) => v + 1)), []);
  useEffect(() => {
    setInstalled(isAppInstalled());
  }, [open]);

  const close = useCallback((remember: boolean) => {
    if (remember) dismissInstallPrompt();
    setOpen(false);
  }, []);

  // Open on demand (More menu, etc.) — even if previously dismissed.
  useEffect(() => {
    const handler = () => {
      if (!isAppInstalled()) setOpen(true);
    };
    window.addEventListener(OPEN_INSTALL_EVENT, handler);
    return () => window.removeEventListener(OPEN_INSTALL_EVENT, handler);
  }, []);

  // Auto-open once for signed-in users who haven't installed or dismissed it.
  // Not inside TikTok/Instagram's built-in browser, where installing isn't possible.
  useEffect(() => {
    if (!user || detectInAppBrowser()) return;
    if (isAppInstalled() || installPromptDismissed()) return;
    const timer = setTimeout(() => {
      if (!isAppInstalled() && !installPromptDismissed()) setOpen(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, [user]);

  if (installed) return null;

  const nativePrompt = getDeferredInstallPrompt();
  const ios = isIosDevice();
  const inApp = detectInAppBrowser();

  const installNow = async () => {
    if (!nativePrompt) return;
    await nativePrompt.prompt();
    const { outcome } = await nativePrompt.userChoice;
    if (outcome === "accepted") close(true);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close(true))}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="items-center text-center">
          <img
            src="/icon-192.png"
            alt="RevMate app icon"
            className="h-16 w-16 rounded-2xl shadow-md"
          />
          <DialogTitle className="text-lg">Get the RevMate app</DialogTitle>
          <DialogDescription>
            Add RevMate to your home screen — it opens full-screen, just like a real app. Free, no
            app store needed.
          </DialogDescription>
        </DialogHeader>

        {inApp ? (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            You're in {IN_APP_NAMES[inApp]}'s browser, which can't add apps. Tap{" "}
            <strong>•••</strong> (top or bottom corner), choose <strong>Open in browser</strong>,
            then come back here.
          </p>
        ) : nativePrompt ? (
          <Button className="w-full" size="lg" onClick={() => void installNow()}>
            <Download className="mr-2 h-4 w-4" /> Install RevMate
          </Button>
        ) : ios ? (
          <ol className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <li className="flex items-center gap-3">
              <Share className="h-5 w-5 shrink-0 text-primary" />
              <span>
                Tap the <strong>Share</strong> button in Safari's bottom bar
              </span>
            </li>
            <li className="flex items-center gap-3">
              <PlusSquare className="h-5 w-5 shrink-0 text-primary" />
              <span>
                Scroll down and tap <strong>Add to Home Screen</strong>
              </span>
            </li>
          </ol>
        ) : (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            Open your browser's menu and choose <strong>Install app</strong> or{" "}
            <strong>Add to Home screen</strong>.
          </p>
        )}

        <Button variant="ghost" className="w-full" onClick={() => close(true)}>
          <X className="mr-2 h-4 w-4" /> Not now
        </Button>
      </DialogContent>
    </Dialog>
  );
}
