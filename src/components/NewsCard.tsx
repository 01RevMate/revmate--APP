import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Heart } from "lucide-react";
import { toast } from "sonner";
import { FeedVideo } from "@/components/FeedVideo";
import { RichText } from "@/components/RichText";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { isVideoUrl } from "@/lib/social";
import { setNewsLike, type NewsDraft } from "@/lib/news";

/**
 * An official RevMate post in the feed: RevMate's logo and name, the topic
 * on the right, text, photos/videos and an optional button. It can be liked
 * but not commented on, shared or reposted. `preview` renders it for the
 * admin composer without any live actions.
 */
export function NewsCard({
  news,
  liked = false,
  preview = false,
  onLikeChange,
}: {
  news: NewsDraft & { id?: string; likes_count?: number };
  liked?: boolean;
  preview?: boolean;
  onLikeChange?: () => void;
}) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  const [likedNow, setLikedNow] = useState(liked);
  const [count, setCount] = useState(news.likes_count ?? 0);
  const [busy, setBusy] = useState(false);
  // The viewer's likes load after the feed, so follow the props until they act.
  useEffect(() => {
    if (!busy) setLikedNow(liked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liked]);
  useEffect(() => {
    if (!busy) setCount(news.likes_count ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [news.likes_count]);
  const media = news.media ?? [];
  const images = media.filter((url) => !isVideoUrl(url));
  const videos = media.filter(isVideoUrl);

  async function toggleLike() {
    if (preview || !news.id) return;
    if (!user) return openAuthModal("Create a free account to like posts.");
    if (busy) return;
    const next = !likedNow;
    setBusy(true);
    setLikedNow(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      await setNewsLike(news.id, user.id, next);
      onLikeChange?.();
    } catch (err) {
      setLikedNow(!next);
      setCount((c) => c + (next ? -1 : 1));
      toast.error(err instanceof Error ? err.message : "Couldn't save your like");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="border-y border-border bg-card p-3 sm:rounded-lg sm:border sm:p-4">
      <header className="flex items-start gap-3">
        <img
          src="/icon-192.png"
          alt=""
          className="size-10 shrink-0 rounded-full border border-border bg-black object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-semibold">
            RevMate <BadgeCheck className="size-4 text-primary" aria-label="Official" />
          </p>
          <p className="text-xs text-muted-foreground">
            {news.sponsored ? "Sponsored · " : ""}
            {formatDistanceToNow(new Date(news.published_at ?? Date.now()), { addSuffix: true })}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {news.topic || "Topic"}
        </span>
      </header>

      <p className="mt-3 whitespace-pre-wrap text-sm">
        {news.body ? (
          <RichText text={news.body} />
        ) : (
          <span className="text-muted-foreground">Your post text</span>
        )}
      </p>

      {videos.map((url) => (
        <FeedVideo
          key={url}
          src={url}
          className="-mx-3 mt-3 w-[calc(100%+1.5rem)] sm:mx-0 sm:w-full sm:rounded-md"
        />
      ))}
      {images.length > 0 && (
        <div
          className={`-mx-3 mt-3 grid gap-1 overflow-hidden sm:mx-0 sm:rounded-md ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {images.slice(0, 4).map((url) => (
            <img
              key={url}
              src={url}
              alt=""
              loading="lazy"
              className={`w-full object-cover ${images.length === 1 ? "max-h-[70vh]" : "aspect-square"}`}
            />
          ))}
        </div>
      )}

      {news.cta_label && news.cta_url && (
        <button
          type="button"
          onClick={() => {
            if (preview) return;
            const url = news.cta_url!;
            if (url.startsWith("/")) void navigate({ to: url });
            else window.open(url, "_blank", "noopener,noreferrer");
          }}
          className="mt-3 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {news.cta_label}
        </button>
      )}

      <div className="mt-3 flex items-center text-sm text-muted-foreground">
        <button
          type="button"
          onClick={() => void toggleLike()}
          aria-pressed={likedNow}
          className={`flex items-center gap-1.5 hover:text-foreground ${likedNow ? "text-red-500 hover:text-red-500" : ""}`}
        >
          <Heart className="size-4" fill={likedNow ? "currentColor" : "none"} />
          {count > 0 ? count : "Like"}
        </button>
      </div>
    </article>
  );
}
