import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

// Long enough that the logo doesn't just flash on a fast connection.
const MIN_SPLASH_MS = 1200;
// Never keep people on the splash if the network is slow — the app
// underneath handles its own loading states.
const MAX_SPLASH_MS = 8000;

// The first word repeats at the end so the roll loops without a jump —
// keep this at five entries to match the keyframes in styles.css.
const LOADER_WORDS = ["turbos", "alloys", "exhausts", "pistons", "turbos"];

/**
 * RevMate logo with a rolling "loading … turbos / alloys / exhausts …" loader,
 * shown when the app is first opened while the session and signed-in profile
 * load. Fades out once everything is ready (or after a timeout). Only mounts
 * once per app load, so in-app navigation never shows it again.
 */
export function SplashScreen() {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: profileLoading } = useProfile();
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

  useEffect(() => {
    if (!ready) return;
    const fadeTimer = window.setTimeout(() => setFading(true), 250);
    const hideTimer = window.setTimeout(() => setHidden(true), 650);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [ready]);

  if (hidden) return null;

  return (
    <div
      aria-hidden
      className={`splash-failsafe fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black px-8 transition-opacity duration-400 ${fading ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <img src="/splash-logo.png" alt="RevMate" className="w-56 max-w-[70vw]" />
      <div className="absolute inset-x-8 bottom-[max(3rem,env(safe-area-inset-bottom))] flex justify-center">
        <div className="rev-loader">
          <p>loading</p>
          <div className="rev-loader-words">
            {LOADER_WORDS.map((word, index) => (
              <span key={index} className="rev-loader-word">
                {word}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
