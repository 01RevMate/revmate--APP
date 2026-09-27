import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { countNewerPosts } from "@/lib/engagement";

const CHECK_EVERY_MS = 45_000;

/**
 * "3 new posts" button that floats in when fresh posts land while you're
 * scrolling. Tapping it jumps to the top and refreshes the feed.
 */
export function NewPostsPill({
  newestCreatedAt,
  enabled,
  onShow,
}: {
  newestCreatedAt: string | null;
  enabled: boolean;
  onShow: () => void;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    if (!enabled || !newestCreatedAt) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void countNewerPosts(newestCreatedAt).then(setCount);
    }, CHECK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [enabled, newestCreatedAt]);

  if (count < 1) return null;
  return (
    <div className="pointer-events-none sticky top-16 z-20 flex justify-center md:top-4">
      <button
        type="button"
        onClick={() => {
          setCount(0);
          onShow();
        }}
        className="pointer-events-auto mt-2 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg"
      >
        <ArrowUp className="size-4" />
        {count === 1 ? "1 new post" : `${count > 20 ? "20+" : count} new posts`}
      </button>
    </div>
  );
}
