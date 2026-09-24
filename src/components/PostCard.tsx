import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  Flag,
  Heart,
  MessageCircle,
  Share2,
  Tag,
  Trash2,
  UserRoundCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { Avatar } from "@/components/Avatar";
import { CarLogo } from "@/components/CarLogo";
import { PostImageViewer } from "@/components/PostImageViewer";
import { carLabel, carPath } from "@/lib/cars";
import { displayUsernameWithoutAt } from "@/lib/usernames";
import { likeGarageCar, unlikeGarageCar } from "@/lib/garage";
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
  carLiked: initiallyCarLiked = false,
  onDeleted,
  canModerate = false,
  onHide,
  immersive = false,
}: {
  post: PostWithAuthor;
  liked: boolean;
  carLiked?: boolean;
  onDeleted?: () => void;
  canModerate?: boolean;
  onHide?: () => void;
  immersive?: boolean;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [liking, setLiking] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [liked, setLiked] = useState(initiallyLiked);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const isCarLike = post.category === "showcase" && !!post.posted_as_garage_car;
  const isForSale = post.category === "for_sale";
  const [carLiked, setCarLiked] = useState(initiallyCarLiked);
  const [carLikesCount, setCarLikesCount] = useState(post.posted_as_garage_car?.likes_count ?? 0);
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
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const commentsRef = useRef<HTMLDivElement>(null);
  const postImages = post.post_images
    .filter((image) => image.image_url)
    .slice()
    .sort((a, b) => a.position - b.position);
  // Cap the feed grid at 4 tiles — the last one shows a "+N" overlay for the
  // rest, instead of every photo bloating the card. Full set stays viewable
  // in PostImageViewer, which the "+N" tile still opens into.
  const MAX_VISIBLE_IMAGES = 4;
  const visibleImages = postImages.slice(0, MAX_VISIBLE_IMAGES);

  // Like state arrives asynchronously (and some pages load it late), so keep
  // the heart in sync with the server data instead of freezing the first value.
  useEffect(() => setLiked(initiallyLiked), [initiallyLiked, post.id]);
  useEffect(() => setLikesCount(post.likes_count), [post.likes_count, post.id]);
  useEffect(() => setCommentsCount(post.comments_count), [post.comments_count, post.id]);
  useEffect(() => setCarLiked(initiallyCarLiked), [initiallyCarLiked, post.id]);
  useEffect(
    () => setCarLikesCount(post.posted_as_garage_car?.likes_count ?? 0),
    [post.posted_as_garage_car?.likes_count, post.id],
  );

  async function toggleLike() {
    if (liking) return;
    if (!user) {
      openAuthModal("Create a free account to like posts.");
      return;
    }
    setLiking(true);
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
    } finally {
      setLiking(false);
    }
  }

  async function toggleCarLike() {
    if (liking || !post.posted_as_garage_car) return;
    if (!user) {
      openAuthModal("Create a free account to like this car.");
      return;
    }
    const garageCarId = post.posted_as_garage_car.id;
    setLiking(true);
    const next = !carLiked;
    setCarLiked(next);
    setCarLikesCount((n) => n + (next ? 1 : -1));
    try {
      if (next) await likeGarageCar(garageCarId, user.id);
      else await unlikeGarageCar(garageCarId, user.id);
      queryClient.invalidateQueries({ queryKey: ["garage-car-rank", garageCarId] });
      queryClient.invalidateQueries({ queryKey: ["feed", "liked-cars"] });
    } catch (err) {
      setCarLiked(!next);
      setCarLikesCount((n) => n + (next ? -1 : 1));
      toast.error(err instanceof Error ? err.message : "Couldn't update like");
    } finally {
      setLiking(false);
    }
  }

  async function openComments() {
    setCommentsOpen(true);
    window.requestAnimationFrame(() =>
      commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
    if (comments === null) {
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

  function toggleComments() {
    if (commentsOpen) setCommentsOpen(false);
    else void openComments();
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim() || commentSaving) return;
    if (!user) {
      openAuthModal("Create a free account to comment.");
      return;
    }
    const body = commentBody.trim();
    setCommentSaving(true);
    try {
      await addComment(post.id, user.id, body);
      setCommentBody("");
      setCommentsCount((n) => n + 1);
      setComments(await fetchComments(post.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post comment");
    } finally {
      setCommentSaving(false);
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/posts/${post.id}`;
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
        `Block ${displayUsernameWithoutAt(post.profiles?.username, "this profile")}? Their posts will disappear and they won't be able to message you.`,
      )
    )
      return;
    setSafetySaving(true);
    try {
      await blockProfile(user.id, post.user_id);
      setDeleted(true);
      await queryClient.invalidateQueries();
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
    <article
      className={
        immersive
          ? "border-y border-border bg-card p-3 sm:rounded-lg sm:border sm:p-4"
          : "rounded-lg border border-border bg-card p-4"
      }
    >
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
                <p className="text-sm font-medium">
                  {displayUsernameWithoutAt(post.profiles?.username)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
            </Link>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${isForSale ? "bg-blue-500 text-white" : "bg-accent text-accent-foreground"}`}
          >
            {isForSale && <Tag className="size-2.5" />}
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

      {post.audience === "friends" && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white">
          <UserRoundCheck className="size-3" />
          Followers only
        </span>
      )}

      {post.community_groups && (
        <Link
          to="/groups/$slug"
          params={{ slug: post.community_groups.slug }}
          className="mt-3 block text-xs font-semibold text-primary"
        >
          {post.community_groups.name} ·{" "}
          {post.community_groups.visibility === "private" ? "Private group" : "Group"}
        </Link>
      )}
      {post.moderation_status === "pending" && (
        <p className="mt-2 text-xs text-amber-600">Awaiting moderator approval</p>
      )}
      {post.moderation_status === "rejected" && (
        <p className="mt-2 text-xs text-destructive">Hidden by group moderators</p>
      )}
      {canModerate && post.group_id && post.moderation_status === "published" && (
        <button
          onClick={() => {
            if (window.confirm("Hide this post from the group?")) onHide?.();
          }}
          className="mt-2 text-xs text-destructive"
        >
          Hide post
        </button>
      )}
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

      {postImages.length > 0 && (
        <div
          className={`mt-3 grid gap-1 overflow-hidden ${immersive ? "-mx-3 rounded-none sm:mx-0 sm:rounded-md" : "rounded-md"} ${
            postImages.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {visibleImages.map((image, index) => {
            const isLastTile = index === visibleImages.length - 1;
            const remaining = postImages.length - visibleImages.length;
            return (
              <button
                key={image.id}
                type="button"
                onClick={() => setViewerIndex(index)}
                aria-label={
                  isLastTile && remaining > 0
                    ? `Open photo ${index + 1} of ${postImages.length}, ${remaining} more`
                    : `Open photo ${index + 1} of ${postImages.length}`
                }
                className={`relative overflow-hidden bg-muted ${postImages.length > 1 ? "aspect-square" : ""}`}
              >
                <img
                  src={image.image_url}
                  alt={`Post photo ${index + 1}`}
                  className={`${postImages.length > 1 ? "size-full" : "max-h-96 w-full"} object-cover transition-transform hover:scale-[1.01]`}
                />
                {isLastTile && remaining > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <span className="text-xl font-semibold text-white">+{remaining}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {isForSale && post.listings && (
        <div
          className={`mt-3 flex items-center justify-between gap-3 bg-muted px-4 py-3 ${immersive ? "-mx-3 sm:-mx-4" : "-mx-4"}`}
        >
          <div>
            {post.posted_as_garage_car && (
              <p className="text-sm font-semibold text-foreground">
                {post.posted_as_garage_car.year ? `${post.posted_as_garage_car.year} ` : ""}
                {post.posted_as_garage_car.make} {post.posted_as_garage_car.model}
              </p>
            )}
            <p className="text-2xl font-bold text-foreground">
              {post.listings.price != null ? `£${post.listings.price.toLocaleString("en-GB")}` : "POA"}
            </p>
          </div>
          {post.listings.headline && (
            <p className="max-w-[55%] text-right text-sm font-medium italic text-foreground/80">
              {post.listings.headline}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-sm text-muted-foreground">
        {isCarLike ? (
          <button
            onClick={toggleCarLike}
            disabled={liking}
            title={`Like ${post.posted_as_garage_car?.nickname} — counts toward its RevMate rank`}
            aria-label={`Like ${post.posted_as_garage_car?.nickname} — counts toward its RevMate rank`}
            className={`relative flex items-center gap-1.5 hover:text-foreground ${carLiked ? "text-amber-500 hover:text-amber-500" : ""}`}
          >
            <span className="relative">
              <Heart
                className={`size-4 transition-transform duration-200 ${carLiked ? "scale-110" : "scale-100"}`}
                fill={carLiked ? "currentColor" : "none"}
              />
              {post.posted_as_garage_car && (
                <CarLogo
                  make={post.posted_as_garage_car.make}
                  className="absolute -bottom-1.5 -right-1.5 size-3 rounded-full border border-background bg-background"
                />
              )}
            </span>
            {carLikesCount > 0 ? carLikesCount : "Like this car"}
          </button>
        ) : (
          <button
            onClick={toggleLike}
            disabled={liking}
            className={`flex items-center gap-1.5 hover:text-foreground ${liked ? "text-red-500 hover:text-red-500" : ""}`}
          >
            <Heart
              className={`size-4 transition-transform duration-200 ${liked ? "scale-110" : "scale-100"}`}
              fill={liked ? "currentColor" : "none"}
            />
            {likesCount > 0 ? likesCount : "Like"}
          </button>
        )}
        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 hover:text-foreground"
        >
          <MessageCircle className="size-4" />
          {commentsCount > 0 ? commentsCount : "Comment"}
        </button>
        <button
          onClick={handleShare}
          aria-label="Share post"
          title="Share post"
          className="flex items-center hover:text-foreground"
        >
          <Share2 className="size-4" />
        </button>
        {user?.id !== post.user_id && (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                user
                  ? setReportOpen((open) => !open)
                  : openAuthModal("Create a free account to report posts.")
              }
              aria-label="Report post"
              title="Report post"
              className="flex size-8 items-center justify-center rounded-full hover:bg-accent hover:text-foreground"
            >
              <Flag className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleBlock}
              disabled={safetySaving}
              aria-label="Block profile"
              title="Block profile"
              className="flex size-8 items-center justify-center rounded-full hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              <UserX className="size-4" />
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
        <div ref={commentsRef} className="mt-3 space-y-3 border-t border-border pt-3">
          {commentsLoading && <p className="text-xs text-muted-foreground">Loading comments…</p>}
          {comments?.map((comment) => (
            <div key={comment.id} className="flex gap-2 text-sm">
              <Avatar
                photoUrl={comment.profiles?.avatar_url}
                fallback={comment.profiles?.username}
                className="size-7"
              />
              <div className="rounded-md bg-muted px-3 py-1.5">
                <p className="text-xs font-medium">
                  {displayUsernameWithoutAt(comment.profiles?.username)}
                </p>
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
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={commentSaving || !commentBody.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Post
            </button>
          </form>
        </div>
      )}

      {viewerIndex !== null && (
        <PostImageViewer
          images={postImages}
          activeIndex={viewerIndex}
          onActiveIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          liked={isCarLike ? carLiked : liked}
          likesCount={isCarLike ? carLikesCount : likesCount}
          commentsCount={commentsCount}
          liking={liking}
          onLike={() => void (isCarLike ? toggleCarLike() : toggleLike())}
          onComment={() => {
            setViewerIndex(null);
            void openComments();
          }}
        />
      )}
    </article>
  );
}
