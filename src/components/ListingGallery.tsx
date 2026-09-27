import { useRef, useState } from "react";

/**
 * Swipeable photo gallery for a listing: one big photo at a time with a
 * "1 / 8" counter and thumbnails, so the price and buttons underneath stay
 * on screen instead of being pushed down by a wall of photos.
 */
export function ListingGallery({ photos, title }: { photos: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  function goTo(next: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
  }

  if (photos.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="relative overflow-hidden rounded-xl bg-muted">
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
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
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
      </div>
      {photos.length > 1 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {photos.map((url, i) => (
            <button
              key={url + i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show photo ${i + 1}`}
              className={`size-14 shrink-0 overflow-hidden rounded-md border-2 ${i === index ? "border-primary" : "border-transparent opacity-70"}`}
            >
              <img src={url} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
