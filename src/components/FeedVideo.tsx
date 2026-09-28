import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Play, Volume2, VolumeX } from "lucide-react";
import { VideoViewer } from "@/components/VideoViewer";

// Only one feed video plays at a time, like Instagram and TikTok.
let playingVideo: HTMLVideoElement | null = null;

function autoplayAllowed() {
  if (typeof window === "undefined") return false;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    ?.saveData;
  return !reducedMotion && !saveData;
}

/**
 * A video in the feed: plays silently on a loop while it's on screen,
 * pauses when you scroll past, and opens a full-screen player with sound
 * when tapped. Honours "reduce motion" and data-saver settings.
 */
export function FeedVideo({ src, className = "" }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ratio, setRatio] = useState(16 / 9);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [autoplay] = useState(autoplayAllowed);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoplay || viewerOpen) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.intersectionRatio >= 0.6) {
          if (playingVideo && playingVideo !== video) playingVideo.pause();
          playingVideo = video;
          void video.play().catch(() => {
            // Autoplay refused (e.g. low-power mode): show the play button.
          });
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
      if (playingVideo === video) playingVideo = null;
    };
  }, [autoplay, viewerOpen]);

  function openViewer() {
    videoRef.current?.pause();
    setViewerOpen(true);
  }

  // Tall phone videos are shown up to 4:5 so they don't take over the feed.
  const shownRatio = Math.min(Math.max(ratio, 4 / 5), 16 / 9);

  return (
    <>
      <div
        className={`group relative overflow-hidden bg-black ${className}`}
        style={{ aspectRatio: String(shownRatio) }}
      >
        <video
          ref={videoRef}
          // "#t=0.1" makes iPhones show the first frame instead of black.
          src={src.includes("#") ? src : `${src}#t=0.1`}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration) setProgress(v.currentTime / v.duration);
          }}
          onClick={openViewer}
          className="absolute inset-0 size-full cursor-pointer object-cover"
        />
        {!playing && !buffering && (
          <button
            type="button"
            onClick={openViewer}
            aria-label="Play video"
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-transform group-hover:scale-105">
              <Play className="ml-1 size-7" fill="currentColor" />
            </span>
          </button>
        )}
        {buffering && (
          <Loader2 className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/80" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Turn sound on" : "Mute"}
          className="absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <button
          type="button"
          onClick={openViewer}
          aria-label="Full screen"
          className="absolute bottom-3 flex size-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
          style={{ right: "3.25rem" }}
        >
          <Maximize2 className="size-4" />
        </button>
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/20">
          <div className="h-full bg-white" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      {viewerOpen && (
        <VideoViewer
          src={src}
          startAt={videoRef.current?.currentTime ?? 0}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
