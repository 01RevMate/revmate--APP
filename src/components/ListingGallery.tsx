import { useRef, useState } from "react";
import { Heart } from "lucide-react";

/**
 * Swipeable photo gallery for a listing: one big photo at a time, edge to
 * edge on phones, with a "1 / 8" counter, a watch heart showing how many
 * people are watching, and a thumbnail strip underneath.
 */
export function ListingGallery({
  photos,
  title,
  watchCount,
  watched,
  onWatch,
}: {
  photos: string[];
  title: string;
  watchCount?: number;
  watched?: boolean;
  /** Shows the heart on the photo when given. */
  onWatch?: (() => void) | undefined;
}) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  function goTo(next: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
  }

  if (photos.length === 0) return null;
  return (
    <div className="-mx-4 mt-3 sm:mx-0">
      <div className="relative overflow-hidden bg-muted sm:rounded-2xl">
        <div
          ref={trackRef}
          onScroll={(e) => {
            const track = e.currentTarget;
            setIndex(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((url, i) => (
            <img
              key={url + i}
              src={url}
              alt={`${title} — photo ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              className="aspect-[4/3] w-full shrink-0 snap-center object-cover"
            />
          ))}
        </div>
        {photos.length > 1 && (
          <>
            <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
              {index + 1} / {photos.length}
            </span>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => goTo(Math.max(0, index - 1))}
              className="absolute left-2 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-lg text-white sm:flex"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => goTo(Math.min(photos.length - 1, index + 1))}
              className="absolute right-2 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-lg text-white sm:flex"
            >
              ›
            </button>
          </>
        )}
        {onWatch && (
          <button
            type="button"
            onClick={onWatch}
            aria-pressed={!!watched}
            aria-label={watched ? "Stop watching" : "Watch this listing"}
            className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-black/70 px-3.5 py-2 text-base font-semibold text-white backdrop-blur"
          >
            {(watchCount ?? 0) > 0 && <span className="tabular-nums">{watchCount}</span>}
            <Heart
              className={`size-5 ${watched ? "text-red-500" : ""}`}
              fill={watched ? "currentColor" : "none"}
            />
          </button>
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto px-4 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {photos.map((url, i) => (
            <button
              key={url + i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show photo ${i + 1}`}
              className={`size-20 shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-background ${i === index ? "ring-foreground" : "ring-transparent opacity-80"}`}
            >
              <img src={url} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
