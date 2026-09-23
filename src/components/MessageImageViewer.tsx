import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function MessageImageViewer({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Message photo"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 text-white"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        autoFocus
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex size-11 items-center justify-center rounded-full bg-black/60 backdrop-blur hover:bg-black/80"
      >
        <X className="size-6" />
      </button>
      <img
        src={imageUrl}
        alt="Shared in this conversation"
        className="max-h-full max-w-full rounded-lg object-contain"
      />
    </div>,
    document.body,
  );
}
