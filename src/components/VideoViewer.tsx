import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Pause, Play, Volume2, VolumeX, X } from "lucide-react";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Full-screen video player with sound: tap to pause/play, drag the bar to
 * seek, and the controls fade away while it plays.
 */
export function VideoViewer({
  src,
  startAt = 0,
  onClose,
}: {
  src: string;
  startAt?: number;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);

  function showControls() {
    setControlsVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 2500);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    showControls();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
    showControls();
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Video player"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black"
      onPointerMove={showControls}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        muted={muted}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration);
          if (startAt > 0 && startAt < v.duration) v.currentTime = startAt;
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onEnded={() => setControlsVisible(true)}
        onClick={togglePlay}
        className="max-h-full max-w-full"
      />

      {buffering && (
        <Loader2 className="pointer-events-none absolute size-10 animate-spin text-white/80" />
      )}
      {!playing && !buffering && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute flex size-16 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur"
        >
          <Play className="ml-1 size-8" fill="currentColor" />
        </button>
      )}

      <div
        className={`pointer-events-none absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0"}`}
      >
        <div className="flex justify-end bg-gradient-to-b from-black/60 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video"
            className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="bg-gradient-to-t from-black/70 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 text-white">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(e) => {
              const v = videoRef.current;
              if (v) v.currentTime = Number(e.target.value);
              showControls();
            }}
            aria-label="Seek"
            className="pointer-events-auto h-1 w-full cursor-pointer accent-white"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="pointer-events-auto"
            >
              {playing ? (
                <Pause className="size-6" fill="currentColor" />
              ) : (
                <Play className="size-6" fill="currentColor" />
              )}
            </button>
            <span className="text-xs tabular-nums">
              {formatTime(time)} / {formatTime(duration)}
            </span>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Turn sound on" : "Mute"}
              className="pointer-events-auto ml-auto"
            >
              {muted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
