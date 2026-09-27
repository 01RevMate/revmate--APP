import { forwardRef, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { Avatar } from "@/components/Avatar";
import { RichText } from "@/components/RichText";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useSocialFeatures } from "@/lib/features";
import { addComment, type CommentWithAuthor } from "@/lib/posts";
import {
  addCommentReply,
  deleteComment,
  fetchMyLikedCommentIds,
  likeComment,
  unlikeComment,
} from "@/lib/social";
import { displayUsernameWithoutAt } from "@/lib/usernames";

type Props = {
  postId: string;
  comments: CommentWithAuthor[] | null;
  loading: boolean;
  onChanged: (delta: number) => Promise<void>;
};

/**
 * Comment list and composer for a post. Once the social SQL is live it
 * shows replies under each comment (one level, like Instagram), comment
 * likes, and lets people delete their own comments.
 */
export const PostComments = forwardRef<HTMLDivElement, Props>(function PostComments(
  { postId, comments, loading, onChanged },
  ref,
) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const threaded = useSocialFeatures();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [replyTo, setReplyTo] = useState<CommentWithAuthor | null>(null);

  const { topLevel, repliesByParent } = useMemo(() => {
    const replies = new Map<string, CommentWithAuthor[]>();
    const top: CommentWithAuthor[] = [];
    for (const comment of comments ?? []) {
      const parentId = threaded ? (comment.parent_id ?? null) : null;
      if (parentId) replies.set(parentId, [...(replies.get(parentId) ?? []), comment]);
      else top.push(comment);
    }
    return { topLevel: top, repliesByParent: replies };
  }, [comments, threaded]);

  const commentIds = useMemo(() => (comments ?? []).map((c) => c.id), [comments]);
  const likedKey = ["comment-likes", postId, user?.id];
  const { data: likedIds } = useQuery({
    queryKey: [...likedKey, commentIds],
    queryFn: () => fetchMyLikedCommentIds(user!.id, commentIds),
    enabled: threaded && !!user && commentIds.length > 0,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || saving) return;
    if (!user) return openAuthModal("Create a free account to comment.");
    setSaving(true);
    try {
      if (threaded) await addCommentReply(postId, user.id, text, replyTo?.id ?? null);
      else await addComment(postId, user.id, text);
      setBody("");
      setReplyTo(null);
      await onChanged(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post comment");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(comment: CommentWithAuthor) {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await deleteComment(comment.id);
      // Deleting a comment also removes its replies.
      await onChanged(-1 - (repliesByParent.get(comment.id)?.length ?? 0));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete comment");
    }
  }

  function startReply(comment: CommentWithAuthor) {
    if (!user) return openAuthModal("Create a free account to reply.");
    setReplyTo(comment);
    const handle = displayUsernameWithoutAt(comment.profiles?.username, "");
    if (handle && comment.user_id !== user.id) setBody(`@${handle} `);
  }

  function renderComment(comment: CommentWithAuthor, isReply: boolean) {
    return (
      <CommentRow
        key={comment.id}
        comment={comment}
        isReply={isReply}
        threaded={threaded}
        liked={likedIds?.has(comment.id) ?? false}
        canDelete={!!user && user.id === comment.user_id}
        onReply={() => startReply(comment)}
        onDelete={() => handleDelete(comment)}
        onLikeChanged={() => queryClient.invalidateQueries({ queryKey: likedKey })}
      />
    );
  }

  return (
    <div ref={ref} className="mt-3 space-y-3 border-t border-border pt-3">
      {loading && <p className="text-xs text-muted-foreground">Loading comments…</p>}
      {topLevel.map((comment) => (
        <div key={comment.id} className="space-y-2">
          {renderComment(comment, false)}
          {repliesByParent.get(comment.id)?.map((reply) => renderComment(reply, true))}
        </div>
      ))}
      <form onSubmit={handleSubmit} className="space-y-1.5">
        {replyTo && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            Replying to {displayUsernameWithoutAt(replyTo.profiles?.username)}
            <button
              type="button"
              onClick={() => {
                setReplyTo(null);
                setBody("");
              }}
              className="font-medium text-foreground hover:underline"
            >
              Cancel
            </button>
          </p>
        )}
        <div className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => !user && openAuthModal("Create a free account to comment.")}
            placeholder={replyTo ? "Write a reply…" : "Write a comment… (use @ to mention)"}
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={saving || !body.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {replyTo ? "Reply" : "Post"}
          </button>
        </div>
      </form>
    </div>
  );
});

function CommentRow({
  comment,
  isReply,
  threaded,
  liked,
  canDelete,
  onReply,
  onDelete,
  onLikeChanged,
}: {
  comment: CommentWithAuthor;
  isReply: boolean;
  threaded: boolean;
  liked: boolean;
  canDelete: boolean;
  onReply: () => void;
  onDelete: () => void;
  onLikeChanged: () => void;
}) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [optimistic, setOptimistic] = useState<{ liked: boolean; count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const isLiked = optimistic?.liked ?? liked;
  const likes = optimistic?.count ?? comment.likes_count ?? 0;

  async function toggleLike() {
    if (!user) return openAuthModal("Create a free account to like comments.");
    if (busy) return;
    const next = !isLiked;
    setBusy(true);
    setOptimistic({ liked: next, count: Math.max(0, likes + (next ? 1 : -1)) });
    try {
      if (next) await likeComment(comment.id, user.id);
      else await unlikeComment(comment.id, user.id);
      onLikeChanged();
    } catch (err) {
      setOptimistic(null);
      toast.error(err instanceof Error ? err.message : "Couldn't update like");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex gap-2 text-sm ${isReply ? "ml-9" : ""}`}>
      <Link
        to="/u/$username"
        params={{ username: comment.profiles?.username ?? "" }}
        className="shrink-0"
      >
        <Avatar
          photoUrl={comment.profiles?.avatar_url}
          fallback={comment.profiles?.username}
          className={isReply ? "size-6" : "size-7"}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="inline-block max-w-full rounded-md bg-muted px-3 py-1.5">
          <p className="flex items-center gap-1 text-xs font-medium">
            {displayUsernameWithoutAt(comment.profiles?.username)}
            <VerifiedBadge userId={comment.user_id} className="size-3" />
          </p>
          <p className="break-words">
            <RichText text={comment.body} />
          </p>
        </div>
        <div className="mt-0.5 flex items-center gap-3 px-1 text-[11px] text-muted-foreground">
          <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
          {threaded && (
            <>
              <button
                type="button"
                onClick={toggleLike}
                className={`flex items-center gap-1 font-medium hover:text-foreground ${isLiked ? "text-red-500 hover:text-red-500" : ""}`}
                aria-label={isLiked ? "Unlike comment" : "Like comment"}
              >
                <Heart className="size-3" fill={isLiked ? "currentColor" : "none"} />
                {likes > 0 ? likes : "Like"}
              </button>
              <button type="button" onClick={onReply} className="font-medium hover:text-foreground">
                Reply
              </button>
            </>
          )}
          {threaded && canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="hover:text-destructive"
              aria-label="Delete comment"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
