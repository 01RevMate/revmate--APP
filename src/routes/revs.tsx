import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clapperboard,
  Heart,
  MessageCircle,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { Avatar } from "@/components/Avatar";
import { RichText } from "@/components/RichText";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { fetchRevs } from "@/lib/engagement";
import { useEngagementFeaturesStatus } from "@/lib/features";
import { fetchMyLikedPostIds, likePost, unlikePost, type PostWithAuthor } from "@/lib/posts";
import { isVideoUrl } from "@/lib/social";
import { displayUsernameWithoutAt } from "@/lib/usernames";

export const Route = createFileRoute("/revs")({
  head: () => ({
    meta: [
      { title: "Revs — RevMate" },
      {
        name: "description",
        content: "Exhausts, launches and walkarounds — swipe through RevMate's car videos.",
      },
      { property: "og:title", content: "Revs — RevMate" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RevsPage,
});

const PAGE = 10;

function RevsPage() {
  const { user } = useAuth();
  const status = useEngagementFeaturesStatus();
  const navigate = useNavigate();
  const [muted, setMuted] = useState(true);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["revs"],
    queryFn: ({ pageParam }) => fetchRevs(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
    enabled: status === "on",
  });
  const revs = useMemo(
    () => [...new Map((data?.pages.flat() ?? []).map((post) => [post.id, post])).values()],
    [data],
  );
  const { data: likedIds } = useQuery({
    queryKey: ["revs", "liked", user?.id, revs.map((p) => p.id)],
    queryFn: () =>
      fetchMyLikedPostIds(
        user!.id,
        revs.map((p) => p.id),
      ),
    enabled: !!user && revs.length > 0,
  });

  return (
    <div className="fixed inset-x-0 bottom-16 top-0 z-40 bg-black md:bottom-0">
      <div
        className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3 text-white"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={() =>
            window.history.length > 1 ? window.history.back() : navigate({ to: "/" })
          }
          aria-label="Back"
          className="flex size-9 items-center justify-center rounded-full bg-black/40"
        >
          <ArrowLeft className="size-5" />
        </button>
        <span className="flex items-center gap-1.5 text-base font-bold">
          <Clapperboard className="size-5" /> Revs
        </span>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Turn sound on" : "Mute"}
          className="flex size-9 items-center justify-center rounded-full bg-black/40"
        >
          {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>
      </div>

      <div className="h-full snap-y snap-mandatory overflow-y-scroll [&::-webkit-scrollbar]:hidden">
        {revs.map((post, index) => (
          <RevItem
            key={post.id}
            post={post}
            muted={muted}
            liked={likedIds?.has(post.id) ?? false}
            onVisible={() => {
              if (index >= revs.length - 3 && hasNextPage && !isFetchingNextPage)
                void fetchNextPage();
            }}
          />
        ))}
        {status !== "on" || (!isLoading && revs.length === 0) ? (
          <div className="flex h-full snap-start flex-col items-center justify-center p-6 text-center text-white">
            <Clapperboard className="size-10 text-white/60" />
            <p className="mt-3 font-semibold">
              {status === "checking"
                ? "Loading…"
                : status === "off"
                  ? "Revs are coming soon"
                  : "No Revs yet"}
            </p>
            {status === "on" && (
              <p className="mt-1 text-sm text-white/70">
                Post a video from the feed and it'll show up here.
              </p>
            )}
            <Link
              to="/"
              className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              Back to the feed
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RevItem({
  post,
  muted,
  liked: initiallyLiked,
  onVisible,
}: {
  post: PostWithAuthor;
  muted: boolean;
  liked: boolean;
  onVisible: () => void;
}) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(initiallyLiked);
  const [likes, setLikes] = useState(post.likes_count);
  const video = post.post_images.find((media) => isVideoUrl(media.image_url));

  useEffect(() => setLiked(initiallyLiked), [initiallyLiked]);

  // Play only the video that's on screen.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const el = videoRef.current;
        if (!el || !entry) return;
        if (entry.intersectionRatio >= 0.6) {
          void el.play().catch(() => {});
          onVisible();
        } else el.pause();
      },
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisible]);

  async function toggleLike() {
    if (!user) return openAuthModal("Create a free account to like Revs.");
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      if (next) await likePost(post.id, user.id);
      else await unlikePost(post.id, user.id);
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    } catch {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  }

  async function share() {
    const url = `${window.location.origin}/posts/${post.id}`;
    try {
      if (typeof navigator.share === "function")
        await navigator.share({ title: "RevMate Revs", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      // share sheet dismissed
    }
  }

  const author =
    post.posted_as_garage_car?.nickname ?? displayUsernameWithoutAt(post.profiles?.username);

  return (
    <div ref={ref} className="relative h-full snap-start snap-always">
      {video && (
        <video
          ref={videoRef}
          src={video.image_url}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          onClick={(e) =>
            e.currentTarget.paused ? void e.currentTarget.play() : e.currentTarget.pause()
          }
          className="h-full w-full object-contain"
        />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 pr-16 text-white">
        <Link
          to="/u/$username"
          params={{ username: post.profiles?.username ?? "" }}
          className="pointer-events-auto flex items-center gap-2"
        >
          <Avatar
            photoUrl={post.posted_as_garage_car?.photo_url ?? post.profiles?.avatar_url}
            fallback={author}
            className="size-8 border border-white/50"
          />
          <span className="flex items-center gap-1 text-sm font-semibold">
            {author}
            <VerifiedBadge userId={post.user_id} />
          </span>
        </Link>
        {post.body && (
          <p className="pointer-events-auto mt-2 line-clamp-3 text-sm">
            <RichText text={post.body} />
          </p>
        )}
      </div>
      <div className="absolute bottom-6 right-3 flex flex-col items-center gap-5 text-white">
        <button
          type="button"
          onClick={toggleLike}
          aria-label={liked ? "Unlike" : "Like"}
          className="flex flex-col items-center gap-1"
        >
          <Heart
            className={`size-8 drop-shadow ${liked ? "text-red-500" : ""}`}
            fill={liked ? "currentColor" : "none"}
          />
          <span className="text-xs font-semibold">{likes}</span>
        </button>
        <Link
          to="/posts/$postId"
          params={{ postId: post.id }}
          aria-label="Comments"
          className="flex flex-col items-center gap-1"
        >
          <MessageCircle className="size-8 drop-shadow" />
          <span className="text-xs font-semibold">{post.comments_count}</span>
        </Link>
        <button
          type="button"
          onClick={share}
          aria-label="Share"
          className="flex flex-col items-center gap-1"
        >
          <Share2 className="size-7 drop-shadow" />
        </button>
      </div>
    </div>
  );
}
