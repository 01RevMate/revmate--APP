import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Avatar } from "@/components/Avatar";
import { RichText } from "@/components/RichText";
import { FeedVideo } from "@/components/FeedVideo";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { fetchOriginalPost, isVideoUrl } from "@/lib/social";
import { displayUsernameWithoutAt } from "@/lib/usernames";

/** The original post shown inside a repost, credited to its author. */
export function RepostedPost({ postId }: { postId: string }) {
  const navigate = useNavigate();
  const { data: original, isLoading } = useQuery({
    queryKey: ["post", postId, "original"],
    queryFn: () => fetchOriginalPost(postId),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="mt-3 h-24 animate-pulse rounded-md border border-border bg-muted/40" />;
  }
  if (!original) {
    return (
      <p className="mt-3 rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
        The original post is no longer available.
      </p>
    );
  }

  const author =
    original.posted_as_garage_car?.nickname ??
    displayUsernameWithoutAt(original.profiles?.username);
  const media = original.post_images.slice().sort((a, b) => a.position - b.position)[0];

  return (
    // A clickable card rather than a <Link>: the caption's @mentions and
    // #hashtags are links themselves, and links can't be nested.
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate({ to: "/posts/$postId", params: { postId: original.id } })}
      onKeyDown={(e) => {
        if (e.key === "Enter") navigate({ to: "/posts/$postId", params: { postId: original.id } });
      }}
      className="mt-3 block cursor-pointer overflow-hidden rounded-md border border-border transition-colors hover:bg-accent/40"
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <Avatar
            photoUrl={original.posted_as_garage_car?.photo_url ?? original.profiles?.avatar_url}
            fallback={author}
            className="size-6"
          />
          <span className="flex items-center gap-1 text-xs font-medium">
            {author}
            <VerifiedBadge userId={original.user_id} className="size-3" />
          </span>
          <span className="text-xs text-muted-foreground">
            · {formatDistanceToNow(new Date(original.created_at), { addSuffix: true })}
          </span>
        </div>
        {original.body && (
          <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm">
            <RichText text={original.body} />
          </p>
        )}
      </div>
      {media &&
        (isVideoUrl(media.image_url) ? (
          // The embed is itself a link to the original post, so the video
          // plays in the full-screen player instead of inline.
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <FeedVideo src={media.image_url} className="max-h-72 w-full" />
          </div>
        ) : (
          <img src={media.image_url} alt="" className="max-h-72 w-full object-cover" />
        ))}
    </div>
  );
}
