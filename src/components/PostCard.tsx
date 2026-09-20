import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { carLabel, carPath } from "@/lib/cars";
import {
  addComment,
  fetchComments,
  likePost,
  unlikePost,
  type CommentWithAuthor,
  type PostWithAuthor,
} from "@/lib/posts";

export function PostCard({
  post,
  liked: initiallyLiked,
}: {
  post: PostWithAuthor;
  liked: boolean;
}) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(initiallyLiked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentWithAuthor[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentsCount, setCommentsCount] = useState(post.comments_count);

  async function toggleLike() {
    if (!user) {
      toast.error("Log in to like posts");
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikesCount((n) => n + (next ? 1 : -1));
    try {
      if (next) await likePost(post.id, user.id);
      else await unlikePost(post.id, user.id);
    } catch (err) {
      setLiked(!next);
      setLikesCount((n) => n + (next ? -1 : 1));
      toast.error(err instanceof Error ? err.message : "Couldn't update like");
    }
  }

  async function toggleComments() {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening && comments === null) {
      setCommentsLoading(true);
      try {
        setComments(await fetchComments(post.id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't load comments");
      } finally {
        setCommentsLoading(false);
      }
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !commentBody.trim()) return;
    const body = commentBody.trim();
    setCommentBody("");
    try {
      await addComment(post.id, user.id, body);
      setCommentsCount((n) => n + 1);
      setComments(await fetchComments(post.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post comment");
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/?post=${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <header className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase text-muted-foreground">
          {post.profiles?.username?.slice(0, 2) ?? "?"}
        </div>
        <div>
          <p className="text-sm font-medium">{post.profiles?.username ?? "Unknown"}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
      </header>

      {post.cars && (
        <Link
          {...carPath(post.cars)}
          className="mt-3 inline-block rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:underline"
        >
          {carLabel(post.cars)}
        </Link>
      )}

      <p className="mt-3 whitespace-pre-wrap text-sm">{post.body}</p>

      <div className="mt-4 flex items-center gap-5 border-t border-border pt-3 text-sm text-muted-foreground">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 hover:text-foreground ${liked ? "text-red-500 hover:text-red-500" : ""}`}
        >
          <Heart className="size-4" fill={liked ? "currentColor" : "none"} />
          {likesCount > 0 ? likesCount : "Like"}
        </button>
        <button onClick={toggleComments} className="flex items-center gap-1.5 hover:text-foreground">
          <MessageCircle className="size-4" />
          {commentsCount > 0 ? commentsCount : "Comment"}
        </button>
        <button onClick={handleShare} className="flex items-center gap-1.5 hover:text-foreground">
          <Share2 className="size-4" />
          Share
        </button>
      </div>

      {commentsOpen && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {commentsLoading && <p className="text-xs text-muted-foreground">Loading comments…</p>}
          {comments?.map((comment) => (
            <div key={comment.id} className="flex gap-2 text-sm">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
                {comment.profiles?.username?.slice(0, 2) ?? "?"}
              </div>
              <div className="rounded-md bg-muted px-3 py-1.5">
                <p className="text-xs font-medium">{comment.profiles?.username ?? "Unknown"}</p>
                <p>{comment.body}</p>
              </div>
            </div>
          ))}
          {user ? (
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write a comment…"
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={!commentBody.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Post
              </button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">
              <Link to="/login" className="underline">
                Log in
              </Link>{" "}
              to comment.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
