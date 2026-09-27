import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

// Never keep people staring at the splash if the network is slow or the
// video can't play — the app underneath handles its own loading states.
const MAX_SPLASH_MS = 9000;

/**
 * Full-screen intro video (~6s) shown when the app is first opened, covering the
 * page while the session and signed-in profile load. Fades out once the
 * video has played through and the profile is ready (or after a timeout).
 * Only mounts once per app load, so in-app navigation never shows it again.
 */
export function SplashScreen() {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: profileLoading } = useProfile();
  const [videoDone, setVideoDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [fading, setFading] = useState(false);
  const [hidden, setHidden] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const dataReady = !authLoading && (!user || !profileLoading);
  const ready = timedOut || (videoDone && dataReady);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), MAX_SPLASH_MS);
    // The server-rendered video can start (or even finish) before React
    // attaches its handlers, and autoplay can be blocked (e.g. iOS Low Power
    // Mode) — so check its state on mount and don't wait on a stuck video.
    const video = videoRef.current;
    if (video?.ended) setVideoDone(true);
    else if (video?.paused) video.play().catch(() => setVideoDone(true));
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setFading(true);
    const timer = window.setTimeout(() => setHidden(true), 400);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (hidden) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-400 ${fading ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <video
        ref={videoRef}
        src="/splash.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={() => setVideoDone(true)}
        onError={() => setVideoDone(true)}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
