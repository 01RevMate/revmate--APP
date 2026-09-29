import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  Bookmark,
  CheckCircle2,
  CircleAlert,
  Flag,
  Flame,
  MessageCircle,
  Repeat2,
  Share2,
  Tag,
  ThumbsUp,
  ThumbsDown,
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
import { PostComments } from "@/components/PostComments";
import { ReactionButton } from "@/components/ReactionButton";
import { PostPoll } from "@/components/PostPoll";
import { ForSaleListingBox } from "@/components/ForSaleListingBox";
import { RepostedPost } from "@/components/RepostedPost";
import { RichText } from "@/components/RichText";
import { FeedVideo } from "@/components/FeedVideo";
import { IssueStatusBar } from "@/components/IssueStatusBar";
import { SpottedCarLink } from "@/components/SpottedCarLink";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { FollowButton } from "@/components/FollowButton";
import { useMyRepostedIds, useMySavedPostIds } from "@/hooks/useSocialState";
import { useSocialFeatures } from "@/lib/features";
import { createRepost, isVideoUrl, savePost, undoRepost, unsavePost } from "@/lib/social";
import { carLabel, carPath } from "@/lib/cars";
import { issueSystemName } from "@/lib/diagnostics";
import { displayUsernameWithoutAt } from "@/lib/usernames";
import {
  dislikeGarageCar,
  fetchGarageCarRank,
  hasDislikedGarageCar,
  hasLikedGarageCar,
  likeGarageCar,
  undislikeGarageCar,
  unlikeGarageCar,
} from "@/lib/garage";
import {
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
  canModerate = false,
  onHide,
  immersive = false,
}: {
  post: PostWithAuthor;
  liked: boolean;
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
  const [issueStatus, setIssueStatus] = useState(post.issue_status);
  // Long posts collapse behind a Facebook-style "See more" instead of
  // pushing the rest of the card (photos, actions) far down the feed.
  const BODY_TRUNCATE_LENGTH = 600;
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const bodyIsLong = (post.body?.length ?? 0) > BODY_TRUNCATE_LENGTH;
  const isCarLike = post.category === "showcase" && !!post.posted_as_garage_car;
  const isForSale = post.category === "for_sale";
  const { data: carRank } = useQuery({
    queryKey: ["garage-car-rank", post.posted_as_garage_car?.id],
    queryFn: () => fetchGarageCarRank(post.posted_as_garage_car!.id),
    enabled: isCarLike,
  });
  // A car's like/dislike is one global reaction per user, shared with every
  // other place that car shows up (other posts, its garage card, profile),
  // so read it from the shared query cache instead of per-page props.
  const reactionCarId = post.posted_as_garage_car?.id;
  const { data: serverCarLiked = false } = useQuery({
    queryKey: ["garage-car-liked", reactionCarId, user?.id],
    queryFn: () => hasLikedGarageCar(reactionCarId!, user!.id),
    enabled: isCarLike && !!user,
    staleTime: 30_000,
  });
  const { data: serverCarDisliked = false } = useQuery({
    queryKey: ["garage-car-disliked", reactionCarId, user?.id],
    queryFn: () => hasDislikedGarageCar(reactionCarId!, user!.id),
    enabled: isCarLike && !!user,
    staleTime: 30_000,
  });
  const [carLiked, setCarLiked] = useState(serverCarLiked);
  const [carLikesCount, setCarLikesCount] = useState(post.posted_as_garage_car?.likes_count ?? 0);
  const [carDisliked, setCarDisliked] = useState(serverCarDisliked);
  const [carDislikesCount, setCarDislikesCount] = useState(
    post.posted_as_garage_car?.dislikes_count ?? 0,
  );
  const [dislikingCar, setDislikingCar] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentWithAuthor[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [deleted, setDeleted] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [safetySaving, setSafetySaving] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const commentsRef = useRef<HTMLDivElement>(null);
  const social = useSocialFeatures();
  const savedIds = useMySavedPostIds();
  const repostedIds = useMyRepostedIds();
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null);
  const [repostOpen, setRepostOpen] = useState(false);
  const [repostCaption, setRepostCaption] = useState("");
  const [reposting, setReposting] = useState(false);
  const saved = savedOverride ?? savedIds?.has(post.id) ?? false;
  // Reposting a repost shares the original, so track state on the original.
  const repostTargetId = post.repost_of_id ?? post.id;
  const reposted = repostedIds?.has(repostTargetId) ?? false;
  const canRepost =
    social &&
    !post.group_id &&
    post.audience === "public" &&
    (post.repost_of_id ? true : post.user_id !== user?.id);
  const sortedMedia = post.post_images
    .filter((image) => image.image_url)
    .slice()
    .sort((a, b) => a.position - b.position);
  const postVideos = sortedMedia.filter((media) => isVideoUrl(media.image_url));
  const postImages = sortedMedia.filter((media) => !isVideoUrl(media.image_url));
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
  useEffect(() => setIssueStatus(post.issue_status), [post.issue_status, post.id]);
  useEffect(() => setCarLiked(serverCarLiked), [serverCarLiked, post.id]);
  useEffect(
    () => setCarLikesCount(post.posted_as_garage_car?.likes_count ?? 0),
    [post.posted_as_garage_car?.likes_count, post.id],
  );
  useEffect(() => setCarDisliked(serverCarDisliked), [serverCarDisliked, post.id]);
  useEffect(
    () => setCarDislikesCount(post.posted_as_garage_car?.dislikes_count ?? 0),
    [post.posted_as_garage_car?.dislikes_count, post.id],
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

  // Push the new reaction to every view of this car and refresh the counts
  // shown on other posts, the garage card and the rankings.
  function syncCarReaction(garageCarId: string, nowLiked: boolean, nowDisliked: boolean) {
    queryClient.setQueryData(["garage-car-liked", garageCarId, user?.id], nowLiked);
    queryClient.setQueryData(["garage-car-disliked", garageCarId, user?.id], nowDisliked);
    queryClient.invalidateQueries({ queryKey: ["garage-car-rank", garageCarId] });
    queryClient.invalidateQueries({ queryKey: ["garage-car", garageCarId] });
    for (const key of [
      "garage",
      "feed",
      "posts-by-user",
      "posts-by-garage-car",
      "posts-by-car",
      "post",
      "groups",
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] });
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
    const clearedDislike = next && carDisliked;
    setCarLiked(next);
    setCarLikesCount((n) => n + (next ? 1 : -1));
    if (clearedDislike) {
      setCarDisliked(false);
      setCarDislikesCount((n) => Math.max(0, n - 1));
    }
    try {
      if (next) await likeGarageCar(garageCarId, user.id);
      else await unlikeGarageCar(garageCarId, user.id);
      syncCarReaction(garageCarId, next, clearedDislike ? false : carDisliked);
    } catch (err) {
      setCarLiked(!next);
      setCarLikesCount((n) => n + (next ? -1 : 1));
      if (clearedDislike) {
        setCarDisliked(true);
        setCarDislikesCount((n) => n + 1);
      }
      toast.error(err instanceof Error ? err.message : "Couldn't update like");
    } finally {
      setLiking(false);
    }
  }

  async function toggleCarDislike() {
    if (dislikingCar || !post.posted_as_garage_car) return;
    if (!user) {
      openAuthModal("Create a free account to react to this car.");
      return;
    }
    const garageCarId = post.posted_as_garage_car.id;
    setDislikingCar(true);
    const next = !carDisliked;
    const clearedLike = next && carLiked;
    setCarDisliked(next);
    setCarDislikesCount((n) => n + (next ? 1 : -1));
    if (clearedLike) {
      setCarLiked(false);
      setCarLikesCount((n) => Math.max(0, n - 1));
    }
    try {
      if (next) await dislikeGarageCar(garageCarId, user.id);
      else await undislikeGarageCar(garageCarId, user.id);
      syncCarReaction(garageCarId, clearedLike ? false : carLiked, next);
    } catch (err) {
      setCarDisliked(!next);
      setCarDislikesCount((n) => n + (next ? -1 : 1));
      if (clearedLike) {
        setCarLiked(true);
        setCarLikesCount((n) => n + 1);
      }
      toast.error(err instanceof Error ? err.message : "Couldn't update dislike");
    } finally {
      setDislikingCar(false);
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
    if (!user) return openAuthModal("Create a free account to read and join the conversation.");
    if (commentsOpen) setCommentsOpen(false);
    else void openComments();
  }

  async function handleCommentsChanged(delta: number) {
    setCommentsCount((n) => Math.max(0, n + delta));
    setComments(await fetchComments(post.id));
  }

  async function toggleSave() {
    if (!user) return openAuthModal("Create a free account to save posts.");
    const next = !saved;
    setSavedOverride(next);
    try {
      if (next) await savePost(post.id, user.id);
      else await unsavePost(post.id, user.id);
      await queryClient.invalidateQueries({ queryKey: ["saved-post-ids", user.id] });
      queryClient.invalidateQueries({ queryKey: ["saved-posts", user.id] });
      setSavedOverride(null);
      toast.success(next ? "Saved — find it under Saved on your profile" : "Removed from saved");
    } catch (err) {
      setSavedOverride(null);
      toast.error(err instanceof Error ? err.message : "Couldn't update saved posts");
    }
  }

  async function handleRepost(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return openAuthModal("Create a free account to repost.");
    setReposting(true);
    try {
      await createRepost(user.id, repostTargetId, repostCaption);
      setRepostOpen(false);
      setRepostCaption("");
      toast.success("Reposted to your followers");
      afterRepostChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't repost");
    } finally {
      setReposting(false);
    }
  }

  async function handleUndoRepost() {
    if (!user) return;
    if (!window.confirm("Remove your repost?")) return;
    try {
      await undoRepost(repostTargetId, user.id);
      toast.success("Repost removed");
      afterRepostChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove repost");
    }
  }

  function afterRepostChange() {
    for (const key of ["reposted-ids", "feed", "posts-by-user", "post"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/posts/${post.id}`;
    // Phones get the native share sheet (WhatsApp, Instagram, Messages…).
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "RevMate", url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
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
        <div className="min-w-0 flex flex-1 items-center gap-3">
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
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {post.posted_as_garage_car.nickname}
                  <VerifiedBadge userId={post.user_id} />
                  {user && user.id !== post.user_id && (
                    <FollowButton myId={user.id} otherId={post.user_id} variant="link" />
                  )}
                </p>
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
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {displayUsernameWithoutAt(post.profiles?.username)}
                  <VerifiedBadge userId={post.user_id} />
                  {user && user.id !== post.user_id && (
                    <FollowButton myId={user.id} otherId={post.user_id} variant="link" />
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
            </Link>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1.5">
          {isCarLike && carRank != null && (
            <Link
              to="/leaderboard"
              title="View the RevMate leaderboard"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              #{carRank}
            </Link>
          )}
          {post.repost_of_id ? (
            <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-foreground">
              <Repeat2 className="size-3" />
              Repost
            </span>
          ) : (
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${isForSale ? "bg-blue-500 text-white" : isCarLike ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm" : "bg-accent text-accent-foreground"}`}
            >
              {isForSale && <Tag className="size-2.5" />}
              {isCarLike && <Flame className="size-2.5" fill="currentColor" />}
              {POST_CATEGORY_LABELS[post.category]}
            </span>
          )}
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
      {(post.cars ||
        post.tagged_make ||
        (!post.repost_of_id &&
          post.category === "diagnostics" &&
          (issueStatus || post.issue_system))) && (
        <div className="mt-3 flex flex-nowrap items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!post.repost_of_id && post.category === "diagnostics" && issueStatus && (
            <span
              className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                issueStatus === "resolved"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}
            >
              {issueStatus === "resolved" ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <CircleAlert className="size-3" />
              )}
              {issueStatus === "resolved" ? "Resolved" : "Unresolved"}
            </span>
          )}
          {!post.repost_of_id && post.category === "diagnostics" && post.issue_system && (
            <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {issueSystemName(post.issue_system)}
            </span>
          )}
          {post.cars && (
            <Link
              {...carPath(post.cars)}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground hover:underline"
            >
              <CarLogo make={post.cars.make} className="size-3" />
              {carLabel(post.cars)}
            </Link>
          )}
          {post.tagged_make && (
            <p className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
              <CarLogo make={post.tagged_make} className="size-3" />
              {[post.tagged_year, post.tagged_make, post.tagged_model].filter(Boolean).join(" ")}
              {post.tagged_engine && (
                <span className="text-muted-foreground">· {post.tagged_engine}</span>
              )}
            </p>
          )}
        </div>
      )}

      {post.body && (
        <div className="mt-3 text-[15px]">
          <p className="whitespace-pre-wrap">
            <RichText text={bodyExpanded || !bodyIsLong ? post.body : `${post.body.slice(0, BODY_TRUNCATE_LENGTH)}…`} />
          </p>
          {bodyIsLong && (
            <button
              type="button"
              onClick={() => setBodyExpanded((v) => !v)}
              className="mt-0.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              {bodyExpanded ? "See less" : "See more"}
            </button>
          )}
        </div>
      )}

      {post.issue_status && (
        <IssueStatusBar
          postId={post.id}
          status={post.issue_status}
          fix={post.issue_fix}
          isAuthor={user?.id === post.user_id}
          onStatusChange={setIssueStatus}
        />
      )}

      {social && post.spotted_garage_car_id && (
        <SpottedCarLink garageCarId={post.spotted_garage_car_id} />
      )}

      {post.repost_of_id && <RepostedPost postId={post.repost_of_id} />}

      {postVideos.map((video) => (
        <FeedVideo
          key={video.id}
          src={video.image_url}
          className={`mt-3 ${immersive ? "-mx-3 w-[calc(100%+1.5rem)] sm:mx-0 sm:w-full sm:rounded-md" : "w-full rounded-md"}`}
        />
      ))}

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

      {social && post.has_poll && <PostPoll postId={post.id} />}

      {isForSale && (
        <ForSaleListingBox
          post={post}
          viewerId={user?.id}
          edgeClassName={immersive ? "-mx-3 sm:-mx-4" : "-mx-4"}
        />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {isCarLike ? (
          <div className="w-full">
            <div className="grid grid-cols-[7fr_3fr] gap-1.5">
              <button
                onClick={toggleCarLike}
                disabled={liking}
                title={`Like ${post.posted_as_garage_car?.nickname} — counts toward its RevMate rank`}
                aria-label={`Like ${post.posted_as_garage_car?.nickname} — counts toward its RevMate rank`}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${carLiked ? "bg-emerald-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
              >
                <ThumbsUp className="size-4" fill={carLiked ? "currentColor" : "none"} />
                <span>{carLiked ? "Liked" : "Like"}</span>
                <span className="font-normal tabular-nums opacity-80">{carLikesCount}</span>
              </button>

              <button
                onClick={toggleCarDislike}
                disabled={dislikingCar}
                title={`Dislike ${post.posted_as_garage_car?.nickname} — affects its RevMate rank`}
                aria-label={`Dislike ${post.posted_as_garage_car?.nickname} — affects its RevMate rank`}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold text-white disabled:opacity-60 ${carDisliked ? "bg-red-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                <ThumbsDown className="size-4" fill={carDisliked ? "currentColor" : "none"} />
                <span>Dislike</span>
                <span className="font-normal tabular-nums opacity-80">{carDislikesCount}</span>
              </button>
            </div>

            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              Votes update this car’s position on the{" "}
              <Link to="/leaderboard" className="underline-offset-2 hover:underline">
                leaderboard
              </Link>
            </p>
          </div>
        ) : (
          <ReactionButton
            postId={post.id}
            reactionCounts={post.reaction_counts}
            liked={liked}
            likesCount={likesCount}
            busy={liking}
            onToggleLike={() => void toggleLike()}
            onReacted={(wasLiked) => {
              if (!wasLiked) {
                setLiked(true);
                setLikesCount((n) => n + 1);
              }
            }}
          />
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
        {canRepost && (
          <button
            onClick={() =>
              !user
                ? openAuthModal("Create a free account to repost.")
                : reposted
                  ? void handleUndoRepost()
                  : setRepostOpen((open) => !open)
            }
            aria-label={reposted ? "Remove repost" : "Repost to your followers"}
            title={reposted ? "Remove repost" : "Repost to your followers"}
            className={`flex items-center gap-1.5 hover:text-foreground ${reposted ? "text-emerald-600 hover:text-emerald-600" : ""}`}
          >
            <Repeat2 className="size-4" />
            {!post.repost_of_id && post.reposts_count > 0 ? post.reposts_count : null}
          </button>
        )}
        {social && (
          <button
            onClick={toggleSave}
            aria-label={saved ? "Remove from saved" : "Save post"}
            title={saved ? "Remove from saved" : "Save post"}
            className={`flex items-center hover:text-foreground ${saved ? "text-primary hover:text-primary" : ""}`}
          >
            <Bookmark className="size-4" fill={saved ? "currentColor" : "none"} />
          </button>
        )}
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

      {repostOpen && (
        <form
          onSubmit={handleRepost}
          className="mt-3 space-y-2 rounded-md border border-border bg-muted/30 p-3"
        >
          <p className="text-sm font-semibold">Repost to your followers</p>
          <textarea
            value={repostCaption}
            onChange={(e) => setRepostCaption(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Add your own caption (optional)"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRepostOpen(false)}
              className="rounded-md px-3 py-1.5 text-xs hover:bg-accent"
            >
              Cancel
            </button>
            <button
              disabled={reposting}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {reposting ? "Reposting…" : "Repost"}
            </button>
          </div>
        </form>
      )}

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
        <PostComments
          ref={commentsRef}
          postId={post.id}
          comments={comments}
          loading={commentsLoading}
          onChanged={handleCommentsChanged}
        />
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
            if (!user) openAuthModal("Create a free account to read and join the conversation.");
            else void openComments();
          }}
        />
      )}
    </article>
  );
}
