import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Flag, Images, Store, X } from "lucide-react";
import { toast } from "sonner";
import type { BusinessPhoto } from "@/lib/businesses";
import { PHOTO_REPORT_REASONS, reportBusinessPhoto } from "@/lib/businessFoundation";
import { SkeletonImage } from "@/components/SkeletonImage";

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
        <SkeletonImage src={shown[0]!.url} alt="" className="size-full object-cover" />
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
            <SkeletonImage src={p.url} alt="" loading="lazy" className="size-full object-cover" />
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
  reporting,
}: {
  photos: BusinessPhoto[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  /** When set, signed-in members can report the photo. `userId` is null when signed out. */
  reporting?: { userId: string | null; onLogin: () => void };
}) {
  const [touchX, setTouchX] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("inappropriate");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
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
      <p className="min-h-12 px-4 pt-2 text-center text-sm text-white/85">{photo.caption}</p>
      {reporting && (
        <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
          {!reportOpen ? (
            <button
              type="button"
              onClick={() => (reporting.userId ? setReportOpen(true) : reporting.onLogin())}
              className="inline-flex items-center gap-1.5 text-xs text-white/70 underline-offset-2 hover:text-white hover:underline"
            >
              <Flag className="size-3.5" /> Report this photo
            </button>
          ) : (
            <form
              className="mx-auto max-w-sm space-y-2 rounded-xl bg-white/10 p-3 text-left"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!reporting.userId) return;
                setSending(true);
                try {
                  await reportBusinessPhoto(photo.id, reporting.userId, reason, details);
                  toast.success("Thanks, we'll take a look at that photo");
                  setReportOpen(false);
                  setDetails("");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Couldn't send the report");
                } finally {
                  setSending(false);
                }
              }}
            >
              <label className="block text-xs font-medium">
                What's wrong with it?
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-md bg-black/50 px-2 py-1.5 text-sm text-white"
                >
                  {PHOTO_REPORT_REASONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="Anything else we should know (optional)"
                className="w-full rounded-md bg-black/50 px-2 py-1.5 text-sm text-white placeholder:text-white/50"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Send report"}
                </button>
                <button type="button" onClick={() => setReportOpen(false)} className="px-3 py-1.5 text-sm text-white/80">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
