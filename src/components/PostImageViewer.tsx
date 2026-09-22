import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Heart, MessageCircle, X } from "lucide-react";

type ViewerImage = {
  id: string;
  image_url: string;
};

export function PostImageViewer({
  images,
  activeIndex,
  onActiveIndexChange,
  onClose,
  liked,
  likesCount,
  commentsCount,
  liking,
  onLike,
  onComment,
}: {
  images: ViewerImage[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onClose: () => void;
  liked: boolean;
  likesCount: number;
  commentsCount: number;
  liking: boolean;
  onLike: () => void;
  onComment: () => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const image = images[activeIndex];

  function moveBy(offset: number) {
    onActiveIndexChange((activeIndex + offset + images.length) % images.length);
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (images.length > 1 && event.key === "ArrowLeft") moveBy(-1);
      if (images.length > 1 && event.key === "ArrowRight") moveBy(1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  if (!image) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post photos"
      className="fixed inset-0 z-[100] bg-black/95 text-white"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        autoFocus
        onClick={onClose}
        aria-label="Close photo viewer"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-20 flex size-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
      >
        <X className="size-6" />
      </button>

      <div
        className="absolute inset-0 flex items-center justify-center px-3 pb-24 pt-16 sm:px-16"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          const end = event.changedTouches[0]?.clientX;
          touchStartX.current = null;
          if (start === null || end === undefined || images.length < 2) return;
          if (start - end > 50) moveBy(1);
          if (end - start > 50) moveBy(-1);
        }}
      >
        <img
          src={image.image_url}
          alt={`Post photo ${activeIndex + 1} of ${images.length}`}
          className="max-h-full max-w-full select-none object-contain"
          draggable={false}
        />
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => moveBy(-1)}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 backdrop-blur hover:bg-black/80 sm:flex"
          >
            <ChevronLeft className="size-7" />
          </button>
          <button
            type="button"
            onClick={() => moveBy(1)}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 backdrop-blur hover:bg-black/80 sm:flex"
          >
            <ChevronRight className="size-7" />
          </button>
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
        {images.length > 1 && (
          <div className="mb-3 flex justify-center gap-2" aria-label="Choose photo">
            {images.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onActiveIndexChange(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                className={`size-2.5 rounded-full transition ${
                  index === activeIndex ? "scale-110 bg-white" : "bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
        <div className="mx-auto flex max-w-sm items-center justify-center gap-3">
          <button
            type="button"
            onClick={onLike}
            disabled={liking}
            className={`flex min-w-28 items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/20 disabled:opacity-60 ${
              liked ? "text-red-400" : "text-white"
            }`}
          >
            <Heart className="size-5" fill={liked ? "currentColor" : "none"} />
            {likesCount > 0 ? likesCount : "Like"}
          </button>
          <button
            type="button"
            onClick={onComment}
            className="flex min-w-28 items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
          >
            <MessageCircle className="size-5" />
            {commentsCount > 0 ? commentsCount : "Comment"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
