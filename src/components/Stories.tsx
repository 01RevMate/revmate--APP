import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Eye, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useProfile } from "@/hooks/useProfile";
import { Avatar } from "@/components/Avatar";
import {
  createStory,
  deleteStory,
  fetchLiveStories,
  fetchMyViewedStoryIds,
  markStoryViewed,
  type Story,
} from "@/lib/engagement";
import { uploadPostImage } from "@/lib/posts";
import { uploadPostVideo, validateVideoFile } from "@/lib/social";
import { validateImageFile } from "@/lib/uploads";
import { displayUsernameWithoutAt } from "@/lib/usernames";

const IMAGE_STORY_MS = 5000;

type StoryGroup = { userId: string; username: string; avatarUrl: string | null; stories: Story[] };

/** Row of 24-hour "Pit Stops" at the top of the feed, yours first. */
export function StoriesRow() {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  const { data: stories } = useQuery({
    queryKey: ["stories"],
    queryFn: fetchLiveStories,
    refetchInterval: 120_000,
  });
  const { data: viewed } = useQuery({
    queryKey: ["stories", "viewed", user?.id],
    queryFn: () => fetchMyViewedStoryIds(user!.id),
    enabled: !!user,
  });

  const groups = useMemo(() => {
    const byUser = new Map<string, StoryGroup>();
    for (const story of stories ?? []) {
      const group = byUser.get(story.user_id) ?? {
        userId: story.user_id,
        username: story.profiles?.username ?? "",
        avatarUrl: story.profiles?.avatar_url ?? null,
        stories: [],
      };
      group.stories.push(story);
      byUser.set(story.user_id, group);
    }
    const list = [...byUser.values()];
    const unseen = (g: StoryGroup) => g.stories.some((s) => !viewed?.has(s.id));
    // Yours first, then people with something you haven't seen, newest first.
    return list.sort((a, b) => {
      if (a.userId === user?.id) return -1;
      if (b.userId === user?.id) return 1;
      if (unseen(a) !== unseen(b)) return unseen(a) ? -1 : 1;
      return (b.stories.at(-1)?.created_at ?? "").localeCompare(a.stories.at(-1)?.created_at ?? "");
    });
  }, [stories, viewed, user?.id]);

  const myGroupIndex = groups.findIndex((g) => g.userId === user?.id);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const isVideo = file.type.startsWith("video/");
    const problem = isVideo ? validateVideoFile(file) : validateImageFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setUploading(true);
    try {
      const mediaUrl = isVideo
        ? await uploadPostVideo(user.id, file)
        : await uploadPostImage(user.id, file);
      const caption = window.prompt("Add a caption? (optional)") ?? "";
      await createStory({
        userId: user.id,
        mediaUrl,
        mediaType: isVideo ? "video" : "image",
        caption,
      });
      toast.success("Added to your Pit Stop — it disappears in 24 hours");
      queryClient.invalidateQueries({ queryKey: ["stories"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add your story");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <div className="flex w-16 shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            onClick={() =>
              !user
                ? openAuthModal("Create a free account to post a Pit Stop.")
                : myGroupIndex >= 0
                  ? setViewing(myGroupIndex)
                  : fileRef.current?.click()
            }
            disabled={uploading}
            className={`relative rounded-full p-0.5 ${myGroupIndex >= 0 ? "bg-gradient-to-tr from-orange-500 to-fuchsia-500" : ""}`}
            aria-label={myGroupIndex >= 0 ? "View your Pit Stop" : "Add a Pit Stop"}
          >
            <Avatar
              photoUrl={profile?.avatar_url}
              fallback={profile?.username ?? "You"}
              className={`size-14 border-2 border-background ${uploading ? "animate-pulse" : ""}`}
            />
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                if (user) fileRef.current?.click();
              }}
              className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground"
            >
              <Plus className="size-3" strokeWidth={3} />
            </span>
          </button>
          <span className="w-full truncate text-center text-[11px] text-muted-foreground">
            {uploading ? "Uploading…" : "Your stop"}
          </span>
        </div>
        {groups.map((group, index) =>
          group.userId === user?.id ? null : (
            <button
              key={group.userId}
              type="button"
              onClick={() =>
                user
                  ? setViewing(index)
                  : openAuthModal("Create a free account to watch Pit Stops from other owners.")
              }
              className="flex w-16 shrink-0 flex-col items-center gap-1"
            >
              <span
                className={`rounded-full p-0.5 ${group.stories.some((s) => !viewed?.has(s.id)) ? "bg-gradient-to-tr from-orange-500 to-fuchsia-500" : "bg-border"}`}
              >
                <Avatar
                  photoUrl={group.avatarUrl}
                  fallback={group.username}
                  className="size-14 border-2 border-background"
                />
              </span>
              <span className="w-full truncate text-center text-[11px]">
                {displayUsernameWithoutAt(group.username)}
              </span>
            </button>
          ),
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {viewing !== null && groups[viewing] && (
        <StoryViewer
          groups={groups}
          startGroup={viewing}
          onClose={() => {
            setViewing(null);
            queryClient.invalidateQueries({ queryKey: ["stories", "viewed"] });
          }}
          onDeleted={() => queryClient.invalidateQueries({ queryKey: ["stories"] })}
        />
      )}
    </>
  );
}

function StoryViewer({
  groups,
  startGroup,
  onClose,
  onDeleted,
}: {
  groups: StoryGroup[];
  startGroup: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const [groupIndex, setGroupIndex] = useState(startGroup);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];
  const isMine = story?.user_id === user?.id;

  function next() {
    if (!group) return;
    if (storyIndex < group.stories.length - 1) setStoryIndex(storyIndex + 1);
    else if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setStoryIndex(0);
    } else onClose();
  }
  function previous() {
    if (storyIndex > 0) setStoryIndex(storyIndex - 1);
    else if (groupIndex > 0) {
      setGroupIndex(groupIndex - 1);
      setStoryIndex(0);
    }
  }

  useEffect(() => {
    setProgress(0);
    if (story && user) void markStoryViewed(story.id, user.id);
  }, [story, user]);

  // Photos advance on a timer; videos advance when they end.
  useEffect(() => {
    if (!story || story.media_type === "video" || paused) return;
    const started = Date.now() - progress * IMAGE_STORY_MS;
    const timer = window.setInterval(() => {
      const value = (Date.now() - started) / IMAGE_STORY_MS;
      if (value >= 1) {
        window.clearInterval(timer);
        next();
      } else setProgress(value);
    }, 50);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, paused]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") previous();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!group || !story) return null;

  async function handleDelete() {
    if (!story || !window.confirm("Delete this Pit Stop?")) return;
    try {
      await deleteStory(story.id);
      onDeleted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black"
      role="dialog"
      aria-label="Pit Stop"
    >
      <div className="relative h-full w-full max-w-md">
        {story.media_type === "video" ? (
          <video
            key={story.id}
            src={story.media_url}
            autoPlay
            playsInline
            className="h-full w-full object-contain"
            onTimeUpdate={(e) =>
              setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))
            }
            onEnded={next}
          />
        ) : (
          <img
            key={story.id}
            src={story.media_url}
            alt=""
            className="h-full w-full object-contain"
          />
        )}

        {/* Tap left/right halves to go back/forward; hold to pause. */}
        <button
          type="button"
          aria-label="Previous"
          className="absolute inset-y-0 left-0 w-1/3"
          onClick={previous}
        />
        <button
          type="button"
          aria-label="Next"
          className="absolute inset-y-0 right-0 w-2/3"
          onClick={next}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
        />

        <div
          className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex gap-1">
            {group.stories.map((s, i) => (
              <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full bg-white"
                  style={{
                    width: `${i < storyIndex ? 100 : i === storyIndex ? Math.min(100, progress * 100) : 0}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-white">
            <Link
              to="/u/$username"
              params={{ username: group.username }}
              onClick={onClose}
              className="flex items-center gap-2"
            >
              <Avatar photoUrl={group.avatarUrl} fallback={group.username} className="size-8" />
              <span className="text-sm font-semibold">
                {displayUsernameWithoutAt(group.username)}
              </span>
            </Link>
            <span className="text-xs text-white/70">
              {formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="relative z-10 ml-auto"
            >
              <X className="size-6" />
            </button>
          </div>
        </div>

        {(story.caption || isMine) && (
          <div
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pb-8 text-white"
            style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
          >
            {story.caption && <p className="text-center text-sm">{story.caption}</p>}
            {isMine && (
              <div className="relative z-10 mt-3 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <Eye className="size-4" /> {story.views_count}{" "}
                  {story.views_count === 1 ? "view" : "views"}
                </span>
                <button type="button" onClick={handleDelete} className="flex items-center gap-1">
                  <Trash2 className="size-4" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
