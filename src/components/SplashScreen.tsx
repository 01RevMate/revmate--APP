import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

// Long enough that the logo doesn't just flash on a fast connection.
const MIN_SPLASH_MS = 1200;
// Never keep people on the splash if the network is slow — the app
// underneath handles its own loading states.
const MAX_SPLASH_MS = 8000;

/**
 * RevMate logo with a loading bar and percentage, shown when the app is first
 * opened while the session and signed-in profile load. The bar eases towards
 * 90% while waiting, then fills to 100% and fades out once everything is
 * ready (or after a timeout). Only mounts once per app load, so in-app
 * navigation never shows it again.
 */
export function SplashScreen() {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: profileLoading } = useProfile();
  const [progress, setProgress] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [fading, setFading] = useState(false);
  const [hidden, setHidden] = useState(false);

  const dataReady = !authLoading && (!user || !profileLoading);
  const ready = timedOut || (minElapsed && dataReady);

  useEffect(() => {
    const minTimer = window.setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    const maxTimer = window.setTimeout(() => setTimedOut(true), MAX_SPLASH_MS);
    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
    };
  }, []);

  // Creep towards 90% while loading — each step covers part of the remaining
  // gap, so it keeps moving but never claims to be done before it is.
  useEffect(() => {
    if (ready) return;
    const interval = window.setInterval(() => {
      setProgress((p) => Math.min(90, p + Math.max(0.5, (90 - p) * 0.08)));
    }, 80);
    return () => window.clearInterval(interval);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    setProgress(100);
    const fadeTimer = window.setTimeout(() => setFading(true), 250);
    const hideTimer = window.setTimeout(() => setHidden(true), 650);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [ready]);

  if (hidden) return null;

  const percent = Math.round(progress);

  return (
    <div
      aria-hidden
      className={`splash-failsafe fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black px-8 transition-opacity duration-400 ${fading ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <img src="/splash-logo.png" alt="RevMate" className="w-56 max-w-[70vw]" />
      <div className="absolute inset-x-8 bottom-[max(3rem,env(safe-area-inset-bottom))] mx-auto max-w-xs">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-200 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs font-medium tabular-nums text-white/70">
          {percent}%
        </p>
      </div>
    </div>
  );
}
