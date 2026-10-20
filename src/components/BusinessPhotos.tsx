import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Images, Store, X } from "lucide-react";
import type { BusinessPhoto } from "@/lib/businesses";

/**
 * The photo grid at the top of a business, like Google's: one big photo and
 * four small ones, with "See all" on the last. Fewer photos fill the space.
 */
export function PhotoMosaic({
  photos,
  name,
  logoUrl,
  onOpen,
}: {
  photos: BusinessPhoto[];
  name: string;
  logoUrl: string | null;
  onOpen: (index: number) => void;
}) {
  if (photos.length === 0) {
    return (
      <div className="-mx-4 flex aspect-[16/7] items-center justify-center bg-muted sm:mx-0 sm:rounded-2xl">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="size-24 rounded-2xl object-cover" />
        ) : (
          <Store className="size-12 text-muted-foreground" />
        )}
      </div>
    );
  }
  const shown = photos.slice(0, 5);
  const extra = photos.length - shown.length;
  const small = shown.slice(1);
  return (
    <div
      className={`-mx-4 grid aspect-[16/9] gap-0.5 overflow-hidden sm:mx-0 sm:rounded-2xl ${small.length ? "grid-cols-4 grid-rows-2" : "grid-cols-1"}`}
    >
      <button
        type="button"
        onClick={() => onOpen(0)}
        className={small.length ? "col-span-2 row-span-2" : ""}
        aria-label={`Open photo 1 of ${name}`}
      >
        <img src={shown[0]!.url} alt="" className="size-full object-cover" />
      </button>
      {small.map((p, i) => {
        const last = i === small.length - 1;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpen(i + 1)}
            aria-label={
              last && extra > 0 ? `See all ${photos.length} photos` : `Open photo ${i + 2}`
            }
            className={`relative ${small.length === 1 ? "col-span-2 row-span-2" : small.length === 2 ? "col-span-2" : small.length === 3 && i === 0 ? "col-span-2" : ""}`}
          >
            <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
            {last && (
              <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
                <Images className="size-3.5" /> {photos.length}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Full-screen photo viewer with previous / next, swipe and a caption. */
export function PhotoLightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: BusinessPhoto[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const [touchX, setTouchX] = useState<number | null>(null);
  const photo = photos[index];
  const go = (step: number) => onIndex((index + step + photos.length) % photos.length);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % photos.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [index, onClose, onIndex, photos.length]);

  if (!photo) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Business photos"
      className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
      onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const end = e.changedTouches[0]?.clientX;
        if (touchX != null && end != null && Math.abs(end - touchX) > 50) go(end < touchX ? 1 : -1);
        setTouchX(null);
      }}
    >
      <div className="flex items-center justify-between px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="text-sm font-semibold tabular-nums">
          {index + 1} / {photos.length}
          <span className="ml-2 font-normal text-white/70">
            {photo.source === "business" ? "From the business" : "From a customer"}
          </span>
        </span>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          aria-label="Close photos"
          className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <X className="size-6" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <img src={photo.url} alt={photo.caption} className="max-h-full max-w-full object-contain" />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-2 hidden size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-2 hidden size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>
      <p className="min-h-12 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-center text-sm text-white/85">
        {photo.caption}
      </p>
    </div>,
    document.body,
  );
}
