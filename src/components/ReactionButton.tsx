import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useEngagementFeatures } from "@/lib/features";
import { fetchMyReaction, REACTIONS, setReaction, type Reaction } from "@/lib/engagement";

const LONG_PRESS_MS = 450;

/**
 * The post like button. Tap to like/unlike; once the engagement SQL is live,
 * press and hold the heart (or tap the reaction count) to pick 🔥 😍 🤯 😂.
 *
 * On phones the hold uses native touch events: in mobile Safari a long press
 * otherwise starts the browser's own select/copy gesture, which cancels
 * pointer events before the hold can register.
 */
export function ReactionButton({
  postId,
  reactionCounts,
  liked,
  likesCount,
  busy,
  onToggleLike,
  onReacted,
}: {
  postId: string;
  reactionCounts: unknown;
  liked: boolean;
  likesCount: number;
  busy: boolean;
  onToggleLike: () => void;
  /** Called after a reaction is saved; `wasLiked` says whether it replaced an existing one. */
  onReacted: (wasLiked: boolean) => void;
}) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const enabled = useEngagementFeatures();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const reactionKey = ["my-reaction", postId, user?.id];
  const { data: myReaction } = useQuery({
    queryKey: reactionKey,
    queryFn: () => fetchMyReaction(postId, user!.id),
    enabled: enabled && !!user && liked,
    staleTime: 60_000,
  });

  const counts = (
    reactionCounts && typeof reactionCounts === "object" ? reactionCounts : {}
  ) as Record<string, number>;
  const topEmojis = REACTIONS.filter((r) => (counts[r.id] ?? 0) > 0)
    .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
    .slice(0, 3)
    .map((r) => r.emoji);
  const mine = liked ? REACTIONS.find((r) => r.id === (myReaction ?? "like")) : undefined;

  async function choose(reaction: Reaction) {
    setPickerOpen(false);
    if (!user) return openAuthModal("Create a free account to react to posts.");
    const wasLiked = liked;
    queryClient.setQueryData(reactionKey, reaction);
    try {
      await setReaction(postId, user.id, reaction, wasLiked);
      onReacted(wasLiked);
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: reactionKey });
      toast.error(err instanceof Error ? err.message : "Couldn't save your reaction");
    }
  }

  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function beginHold(x: number, y: number) {
    if (!enabled) return;
    longPressed.current = false;
    pressStart.current = { x, y };
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      pressTimer.current = null;
      setPickerOpen(true);
      // A little buzz so people feel the hold worked (Android; ignored elsewhere).
      navigator.vibrate?.(15);
    }, LONG_PRESS_MS);
  }
  // Scrolling the feed with a finger on the heart shouldn't open the picker.
  function moveHold(x: number, y: number) {
    const start = pressStart.current;
    if (start && Math.hypot(x - start.x, y - start.y) > 10) cancelHold();
  }
  function cancelHold() {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressStart.current = null;
  }

  useEffect(() => {
    const el = buttonRef.current;
    if (!el || !enabled) return;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) beginHold(t.clientX, t.clientY);
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) moveHold(t.clientX, t.clientY);
    };
    const onEnd = (e: TouchEvent) => {
      cancelHold();
      // After a hold, stop the tap that would otherwise also like the post.
      if (longPressed.current && e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: false });
    // iOS may cancel the touch as it considers its own gestures; the timer
    // keeps running unless the finger actually moved.
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      cancelHold();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return (
    <div className="no-callout relative flex items-center gap-1">
      <button
        ref={buttonRef}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          if (liked && myReaction && myReaction !== "like")
            queryClient.setQueryData(reactionKey, null);
          onToggleLike();
        }}
        // Mouse: hold the button down. Touch is handled natively above.
        onPointerDown={(e) => e.pointerType === "mouse" && beginHold(e.clientX, e.clientY)}
        onPointerMove={(e) => e.pointerType === "mouse" && moveHold(e.clientX, e.clientY)}
        onPointerUp={(e) => e.pointerType === "mouse" && cancelHold()}
        onPointerLeave={(e) => e.pointerType === "mouse" && cancelHold()}
        onContextMenu={(e) => {
          // Phones fire this on a long press too — use it for the picker
          // instead of the browser's own menu.
          if (!enabled) return;
          e.preventDefault();
          longPressed.current = true;
          setPickerOpen(true);
        }}
        disabled={busy}
        title={enabled ? "Tap to like · press and hold for more reactions" : undefined}
        style={{ WebkitTouchCallout: "none", touchAction: "manipulation" }}
        className={`flex select-none items-center gap-1.5 hover:text-foreground ${liked ? "text-red-500 hover:text-red-500" : ""}`}
      >
        {mine && mine.id !== "like" ? (
          <span className="text-base leading-none">{mine.emoji}</span>
        ) : (
          <Heart
            className={`size-4 transition-transform duration-200 ${liked ? "scale-110" : "scale-100"}`}
            fill={liked ? "currentColor" : "none"}
          />
        )}
        {(!enabled || likesCount === 0) && (likesCount > 0 ? likesCount : "Like")}
      </button>
      {enabled && likesCount > 0 && (
        // Tapping the count opens the reactions too, for anyone whose
        // browser won't let them hold.
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label={`${likesCount} reactions. Choose a reaction`}
          className="flex items-center gap-1 rounded-full px-1 hover:text-foreground"
        >
          {topEmojis.length > 1 && (
            <span className="text-xs leading-none tracking-tighter">{topEmojis.join("")}</span>
          )}
          {likesCount}
        </button>
      )}
      {pickerOpen && (
        <>
          <button
            type="button"
            aria-label="Close reactions"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setPickerOpen(false)}
          />
          <div
            role="menu"
            className="absolute bottom-full left-0 z-40 mb-2 flex gap-1 rounded-full border border-border bg-popover px-2 py-1.5 shadow-lg"
          >
            {REACTIONS.map((reaction) => (
              <button
                key={reaction.id}
                type="button"
                role="menuitem"
                onClick={() => void choose(reaction.id)}
                aria-label={reaction.label}
                title={reaction.label}
                className={`rounded-full p-1 text-2xl leading-none transition-transform hover:scale-125 ${mine?.id === reaction.id ? "bg-accent" : ""}`}
              >
                {reaction.emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
