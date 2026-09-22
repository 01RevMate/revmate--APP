import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Flag, Heart, MessageCircle, Share2, Trash2, UserX } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { Avatar } from "@/components/Avatar";
import { CarLogo } from "@/components/CarLogo";
import { carLabel, carPath } from "@/lib/cars";
import {
  addComment,
  deletePost,
  fetchComments,
  likePost,
  unlikePost,
  POST_CATEGORY_LABELS,
  type CommentWithAuthor,
  type PostWithAuthor,
} from "@/lib/posts";
import { blockProfile, reportPost, type ReportReason } from "@/lib/moderation";

export function PostCard({
  post,
  liked: initiallyLiked,
  onDeleted,
}: {
  post: PostWithAuthor;
  liked: boolean;
  onDeleted?: () => void;
}) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [liked, setLiked] = useState(initiallyLiked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentWithAuthor[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [deleted, setDeleted] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [safetySaving, setSafetySaving] = useState(false);

  async function toggleLike() {
    if (!user) {
      openAuthModal("Create a free account to like posts.");
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
    if (!commentBody.trim()) return;
    if (!user) {
      openAuthModal("Create a free account to comment.");
      return;
    }
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

  async function handleDelete() {
    if (!window.confirm("Delete this post?")) return;
    try {
      await deletePost(post.id);
      setDeleted(true);
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete post");
    }
  }

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return openAuthModal("Create a free account to report posts.");
    setSafetySaving(true);
    try {
      await reportPost(post.id, user.id, reportReason, reportDetails);
      setReportOpen(false);
      setReportDetails("");
      toast.success("Report sent to the RevMate moderation team.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the report");
    } finally {
      setSafetySaving(false);
    }
  }

  async function handleBlock() {
    if (!user) return openAuthModal("Create a free account to block profiles.");
    if (
      !window.confirm(
        `Block @${post.profiles?.username ?? "this profile"}? Their posts will disappear and they won't be able to message you.`,
      )
    )
      return;
    setSafetySaving(true);
    try {
      await blockProfile(user.id, post.user_id);
      setDeleted(true);
      onDeleted?.();
      toast.success("Profile blocked.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't block this profile");
    } finally {
      setSafetySaving(false);
    }
  }

  if (deleted) return null;

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {post.posted_as_garage_car ? (
            <Link
              to="/u/$username/cars/$carId"
              params={{
                username: post.profiles?.username ?? "",
                carId: post.posted_as_garage_car.id,
              }}
              className="flex items-center gap-3 hover:opacity-80"
            >
              <div className="relative">
                <Avatar
                  photoUrl={post.posted_as_garage_car.photo_url}
                  fallback={post.posted_as_garage_car.nickname}
                />
                <CarLogo
                  make={post.posted_as_garage_car.make}
                  className="absolute -bottom-1 -right-1 size-4 rounded-full border border-background bg-background"
                />
              </div>
              <div>
                <p className="text-sm font-medium">{post.posted_as_garage_car.nickname}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
            </Link>
          ) : (
            <Link
              to="/u/$username"
              params={{ username: post.profiles?.username ?? "" }}
              className="flex items-center gap-3 hover:opacity-80"
            >
              <Avatar photoUrl={post.profiles?.avatar_url} fallback={post.profiles?.username} />
              <div>
                <p className="text-sm font-medium">{post.profiles?.username ?? "Unknown"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
            </Link>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-foreground">
            {POST_CATEGORY_LABELS[post.category]}
          </span>
          {user?.id === post.user_id && (
            <button
              onClick={handleDelete}
              className="text-muted-foreground hover:text-destructive"
              title="Delete post"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </header>

      {post.cars && (
        <Link
          {...carPath(post.cars)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:underline"
        >
          <CarLogo make={post.cars.make} className="size-3.5" />
          {carLabel(post.cars)}
        </Link>
      )}

      <p className="mt-3 whitespace-pre-wrap text-sm">{post.body}</p>

      {post.post_images.length > 0 && (
        <div
          className={`mt-3 grid gap-1 overflow-hidden rounded-md ${
            post.post_images.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {post.post_images
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((image) => (
              <img
                key={image.id}
                src={image.image_url}
                alt=""
                className="max-h-96 w-full bg-muted object-cover"
              />
            ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-5 border-t border-border pt-3 text-sm text-muted-foreground">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 hover:text-foreground ${liked ? "text-red-500 hover:text-red-500" : ""}`}
        >
          <Heart
            className={`size-4 transition-transform duration-200 ${liked ? "scale-110" : "scale-100"}`}
            fill={liked ? "currentColor" : "none"}
          />
          {likesCount > 0 ? likesCount : "Like"}
        </button>
        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 hover:text-foreground"
        >
          <MessageCircle className="size-4" />
          {commentsCount > 0 ? commentsCount : "Comment"}
        </button>
        <button onClick={handleShare} className="flex items-center gap-1.5 hover:text-foreground">
          <Share2 className="size-4" />
          Share
        </button>
        {user?.id !== post.user_id && (
          <div className="ml-auto flex items-center gap-4">
            <button
              onClick={() =>
                user
                  ? setReportOpen((open) => !open)
                  : openAuthModal("Create a free account to report posts.")
              }
              className="flex items-center gap-1.5 hover:text-foreground"
            >
              <Flag className="size-4" /> Report
            </button>
            <button
              onClick={handleBlock}
              disabled={safetySaving}
              className="flex items-center gap-1.5 hover:text-destructive disabled:opacity-50"
            >
              <UserX className="size-4" /> Block
            </button>
          </div>
        )}
      </div>

      {reportOpen && (
        <form
          onSubmit={handleReport}
          className="mt-3 space-y-2 rounded-md border border-border bg-muted/30 p-3"
        >
          <p className="text-sm font-semibold">Why are you reporting this post?</p>
          <select
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value as ReportReason)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="spam">Spam</option>
            <option value="scam">Scam or suspicious offer</option>
            <option value="sexual_spam">Sexual spam or adult promotion</option>
            <option value="harassment">Harassment or bullying</option>
            <option value="hate">Hate speech</option>
            <option value="dangerous">Dangerous advice</option>
            <option value="off_topic">Posted in the wrong place</option>
            <option value="other">Something else</option>
          </select>
          <textarea
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Give the admins any useful context (optional)"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="rounded-md px-3 py-1.5 text-xs hover:bg-accent"
            >
              Cancel
            </button>
            <button
              disabled={safetySaving}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {safetySaving ? "Sending…" : "Send report"}
            </button>
          </div>
        </form>
      )}

      {commentsOpen && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {commentsLoading && <p className="text-xs text-muted-foreground">Loading comments…</p>}
          {comments?.map((comment) => (
            <div key={comment.id} className="flex gap-2 text-sm">
              <Avatar
                photoUrl={comment.profiles?.avatar_url}
                fallback={comment.profiles?.username}
                className="size-7"
              />
              <div className="rounded-md bg-muted px-3 py-1.5">
                <p className="text-xs font-medium">{comment.profiles?.username ?? "Unknown"}</p>
                <p>{comment.body}</p>
              </div>
            </div>
          ))}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              onFocus={() => !user && openAuthModal("Create a free account to comment.")}
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
        </div>
      )}
    </article>
  );
}
