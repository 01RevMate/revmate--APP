import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Check,
  ChevronDown,
  Eye,
  Gauge,
  ImagePlus,
  MessagesSquare,
  Paintbrush,
  Sparkles,
  Stethoscope,
  UserRoundCheck,
  Video,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AGE_LIMITS, useOldEnough } from "@/lib/legal";

import { useAuthModal } from "@/hooks/useAuthModal";
import { useProfile } from "@/hooks/useProfile";
import {
  attachImagesToPost,
  createPost,
  uploadPostImage,
  uploadProtectedPostImage,
  deletePost,
  MAX_IMAGES_PER_POST,
  POST_CATEGORY_LABELS,
  type Post,
} from "@/lib/posts";
import { validateImageFile } from "@/lib/uploads";
import { useEngagementFeatures, useSocialFeatures } from "@/lib/features";
import {
  createPollOptions,
  MAX_POLL_OPTIONS,
  searchGarageCarsForSpotting,
  uploadPostVideo,
  validateVideoFile,
} from "@/lib/social";
import { displayUsernameWithoutAt } from "@/lib/usernames";
import {
  activeMentionQuery,
  insertMention,
  MentionSuggestions,
} from "@/components/MentionSuggestions";
import { useQuery } from "@tanstack/react-query";
import { CarPicker } from "@/components/CarPicker";
import { CarTagFields, EMPTY_CAR_TAG, type CarTag } from "@/components/CarTagFields";
import {
  activeHashtagQuery,
  HashtagSuggestions,
  insertHashtag,
} from "@/components/HashtagSuggestions";
import { ISSUE_SYSTEMS, useDiagnosticsFeature } from "@/lib/diagnostics";
import { CarLogo } from "@/components/CarLogo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchGarage, type GarageCar } from "@/lib/garage";
import { Avatar } from "@/components/Avatar";

// "for_sale" posts are only created via the sell flow (pushed from a
// listing), not chosen directly here, so it's excluded from this picker.
type ComposerCategory = Exclude<Post["category"], "for_sale">;

const CATEGORY_DETAILS = {
  discussion: { icon: MessagesSquare, description: "General car chat and opinions" },
  diagnostics: { icon: Stethoscope, description: "Faults, warning lights and fixes" },
  modifications: { icon: Wrench, description: "Upgrades, tuning and changes" },
  bodywork: { icon: Paintbrush, description: "Paint, dents and body repairs" },
  maintenance: { icon: Gauge, description: "Servicing, upkeep and how-tos" },
  showcase: { icon: Sparkles, description: "Show everyone your car or build" },
  spotted: { icon: Eye, description: "A great car you saw out and about" },
} satisfies Record<ComposerCategory, { icon: typeof MessagesSquare; description: string }>;

export function PostComposer({
  onPosted,
  lockedGroup,
  requiredCarIdentity = false,
  carIdentityNote,
  garageCars = [],
  preferredGarageCarId = null,
  onGarageCarSelected,
  audience = "public",
  bare = false,
  helpPost = false,
  initialBody = "",
}: {
  onPosted: () => void;
  lockedGroup?: { id: string; name: string; postPolicy: "member" | "moderated" };
  requiredCarIdentity?: boolean;
  /** Replaces the default hint under "Which car are you posting as?". */
  carIdentityNote?: string | undefined;
  garageCars?: GarageCar[];
  preferredGarageCarId?: string | null;
  onGarageCarSelected?: (garageCarId: string) => void;
  audience?: Post["audience"];
  /** Drops the card chrome (border/background/padding) — for when it's
   * already inside its own container, like a dialog. */
  bare?: boolean;
  /** "Ask for help": always a help post, so skip the category list and go
   * straight to "Which part of the car?". */
  helpPost?: boolean;
  /** Text to start with, e.g. "Is the Tesco charger working?" from the charger map. */
  initialBody?: string;
}) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const { data: profile } = useProfile();
  const [body, setBody] = useState(initialBody);
  const [carId, setCarId] = useState("");
  const [tagging, setTagging] = useState(false);
  const [selectedGarageCarId, setSelectedGarageCarId] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [publishingCategory, setPublishingCategory] = useState<Post["category"] | null>(null);
  const [images, setImages] = useState<{ file: File; previewUrl: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const social = useSocialFeatures();
  const [video, setVideo] = useState<{ file: File; previewUrl: string } | null>(null);
  const [pollOptions, setPollOptions] = useState<string[] | null>(null);
  const [spotting, setSpotting] = useState(false);
  const [spotSearch, setSpotSearch] = useState("");
  const [spottedCar, setSpottedCar] = useState<{ id: string; label: string } | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [hashtagQuery, setHashtagQuery] = useState<string | null>(null);
  const diagnosticsOn = useDiagnosticsFeature();
  const [issueStep, setIssueStep] = useState(false);
  const [carTag, setCarTag] = useState<CarTag>(EMPTY_CAR_TAG);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const engagement = useEngagementFeatures();

  // Videos go to the public bucket, so they're only offered on public posts.
  const canAddVideo = social && !lockedGroup && audience === "public";
  const { data: spotResults } = useQuery({
    queryKey: ["spot-search", spotSearch],
    queryFn: () => searchGarageCarsForSpotting(spotSearch),
    enabled: spotting && spotSearch.trim().length >= 2,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!requiredCarIdentity) return;
    const preferred = garageCars.find((car) => car.id === preferredGarageCarId)?.id;
    const active = garageCars.find((car) => car.id === profile?.active_garage_car_id)?.id;
    const currentIsValid = garageCars.some((car) => car.id === selectedGarageCarId);
    if (!currentIsValid) {
      setSelectedGarageCarId(
        preferred ?? active ?? (garageCars.length === 1 ? garageCars[0]!.id : ""),
      );
    }
  }, [
    garageCars,
    preferredGarageCarId,
    profile?.active_garage_car_id,
    requiredCarIdentity,
    selectedGarageCarId,
  ]);

  // Who this post goes out as: yourself or one of your cars. Starts from the
  // identity picked in the top bar, and can be switched just for this post.
  const [asCarId, setAsCarId] = useState<string | null | undefined>(undefined);
  const [identityOpen, setIdentityOpen] = useState(false);
  const { data: myGarage } = useQuery({
    queryKey: ["garage", user?.id],
    queryFn: () => fetchGarage(user!.id),
    enabled: !!user && !requiredCarIdentity,
    staleTime: 60_000,
  });
  const myCars = (myGarage ?? []).filter((car) => car.ownership_status !== "previous");
  const chosenCarId = asCarId !== undefined ? asCarId : (profile?.active_garage_car_id ?? null);
  const postingCar = myCars.find((car) => car.id === chosenCarId) ?? null;
  const postingAs = requiredCarIdentity ? selectedGarageCarId : (postingCar?.id ?? "");

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const room = MAX_IMAGES_PER_POST - images.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_IMAGES_PER_POST} images.`);
      return;
    }

    const accepted: { file: File; previewUrl: string }[] = [];
    for (const file of files.slice(0, room)) {
      const problem = validateImageFile(file);
      if (problem) {
        toast.error(problem);
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (files.length > room) {
      toast.error(`Only added ${room} more — ${MAX_IMAGES_PER_POST} images max per post.`);
    }
    setImages((prev) => [...prev, ...accepted]);
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index]!.previewUrl);
      next.splice(index, 1);
      return next;
    });
  }

  function handleVideoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = validateVideoFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (video) URL.revokeObjectURL(video.previewUrl);
    setVideo({ file, previewUrl: URL.createObjectURL(file) });
  }

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value);
    setMentionQuery(activeMentionQuery(e.target.value, e.target.selectionStart));
    setHashtagQuery(activeHashtagQuery(e.target.value, e.target.selectionStart));
  }

  function pickHashtag(tag: string) {
    const caret = textareaRef.current?.selectionStart ?? body.length;
    const next = insertHashtag(body, caret, tag);
    setBody(next.text);
    setHashtagQuery(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(next.caret, next.caret);
    });
  }

  function pickMention(handle: string) {
    const caret = textareaRef.current?.selectionStart ?? body.length;
    const next = insertMention(body, caret, handle);
    setBody(next.text);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(next.caret, next.caret);
    });
  }

  const pollReady = !pollOptions || pollOptions.filter((option) => option.trim()).length >= 2;

  function resetForm() {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    if (video) URL.revokeObjectURL(video.previewUrl);
    setBody("");
    setCarTag(EMPTY_CAR_TAG);
    setIssueStep(false);
    setHashtagQuery(null);
    setCarId("");
    setTagging(false);
    setImages([]);
    setVideo(null);
    setPollOptions(null);
    setSpotting(false);
    setSpotSearch("");
    setSpottedCar(null);
    setMentionQuery(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    if (!user) {
      openAuthModal("Create a free account to post to the feed.");
      return;
    }
    if (requiredCarIdentity && !postingAs) {
      toast.error("Choose one of your cars before posting here.");
      return;
    }
    if (!pollReady) {
      toast.error("Give your poll at least two options.");
      return;
    }
    // A linked spotted car already says what kind of post this is.
    if (spottedCar) {
      void publishPost("spotted");
      return;
    }
    if (helpPost && diagnosticsOn) setIssueStep(true);
    setCategoryOpen(true);
  }

  async function publishPost(category: Post["category"], issueSystem?: string) {
    if (saving || !user || !body.trim()) return;
    setPublishingCategory(category);
    setSaving(true);
    try {
      const postId = await createPost({
        userId: user.id,
        body: body.trim(),
        carId: carId || undefined,
        postedAsGarageCarId: postingAs || undefined,
        category,
        groupId: lockedGroup?.id,
        audience,
        spottedGarageCarId: category === "spotted" ? spottedCar?.id : undefined,
        issueSystem: category === "diagnostics" ? issueSystem : undefined,
        carTag: tagging && diagnosticsOn && carTag.make ? carTag : undefined,
      });
      if (images.length > 0 || video || pollOptions) {
        try {
          const urls = await Promise.all(
            images.map((img) =>
              lockedGroup || audience === "friends"
                ? uploadProtectedPostImage(user.id, postId, img.file)
                : uploadPostImage(user.id, img.file),
            ),
          );
          if (video && canAddVideo) urls.unshift(await uploadPostVideo(user.id, video.file));
          if (urls.length > 0) await attachImagesToPost(postId, urls);
          if (pollOptions) {
            await createPollOptions(
              postId,
              pollOptions.map((label) => ({ label })),
            );
          }
        } catch (error) {
          // Remove the incomplete post so retrying cannot publish duplicates.
          await deletePost(postId);
          throw error;
        }
      }
      toast.success(
        lockedGroup?.postPolicy === "moderated"
          ? "Post submitted. Group moderators may need to approve it."
          : audience === "friends"
            ? "Followers-only post published."
            : "Post published.",
      );
      setCategoryOpen(false);
      resetForm();
      onPosted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post");
    } finally {
      setSaving(false);
      setPublishingCategory(null);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={bare ? "space-y-3" : "space-y-3 rounded-lg border border-border bg-card p-4"}
    >
      {lockedGroup && (
        <p className="text-xs font-medium text-primary">
          Posting in {lockedGroup.name} ·{" "}
          {lockedGroup.postPolicy === "moderated" ? "Posts may need approval" : "Group members"}
        </p>
      )}
      {user && profile && !requiredCarIdentity && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIdentityOpen((v) => !v)}
            aria-expanded={identityOpen}
            className="flex w-full items-center gap-2.5 rounded-lg bg-muted/60 px-2.5 py-2 text-left hover:bg-muted"
          >
            {postingCar ? (
              <Avatar
                photoUrl={postingCar.photo_url}
                fallback={postingCar.nickname}
                className="size-8"
              />
            ) : (
              <Avatar
                photoUrl={profile.avatar_url}
                fallback={profile.username}
                className="size-8"
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Posting as
              </span>
              <span className="block truncate text-sm font-semibold">
                {postingCar
                  ? `${postingCar.nickname} · ${postingCar.make} ${postingCar.model}`
                  : `${profile.username.startsWith("@") ? profile.username : `@${profile.username}`} (you)`}
              </span>
            </span>
            {myCars.length > 0 && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-primary">
                Change <ChevronDown className="size-3.5" />
              </span>
            )}
          </button>
          {identityOpen && myCars.length > 0 && (
            <ul
              role="listbox"
              aria-label="Post as"
              className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
            >
              {[null, ...myCars].map((car) => {
                const selected = (car?.id ?? null) === (postingCar?.id ?? null);
                return (
                  <li key={car?.id ?? "me"}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setAsCarId(car?.id ?? null);
                        setIdentityOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent ${selected ? "bg-accent/60 font-semibold" : ""}`}
                    >
                      {car ? (
                        <Avatar
                          photoUrl={car.photo_url}
                          fallback={car.nickname}
                          className="size-7"
                        />
                      ) : (
                        <Avatar
                          photoUrl={profile.avatar_url}
                          fallback={profile.username}
                          className="size-7"
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {car ? `${car.nickname} · ${car.make} ${car.model}` : "Yourself"}
                      </span>
                      {selected && <Check className="size-4 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {!lockedGroup && audience === "friends" && (
        <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900">
          <UserRoundCheck className="size-4 shrink-0" />
          Followers only — only people who follow you can see this post.
        </div>
      )}
      <div className="relative rounded-md border border-input bg-background">
        {/* Highlights #tags and @mentions behind the text as it's typed. */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3 py-2 text-sm text-transparent"
        >
          {highlightTags(body)}
        </div>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleBodyChange}
          onScroll={(e) => {
            if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          onBlur={() => {
            setMentionQuery(null);
            setHashtagQuery(null);
          }}
          onFocus={() => !user && openAuthModal("Create a free account to post to the feed.")}
          placeholder={
            helpPost
              ? "What's the problem? Say what happens, when, and anything you've tried."
              : pollOptions
                ? "Ask your question…"
                : "What are you working on? Use @ to mention and # to tag"
          }
          maxLength={10000}
          rows={3}
          className="relative block w-full resize-none rounded-md bg-transparent px-3 py-2 text-sm outline-none"
        />
      </div>
      <MentionSuggestions query={mentionQuery} onPick={pickMention} />
      <HashtagSuggestions query={mentionQuery ? null : hashtagQuery} onPick={pickHashtag} />
      {requiredCarIdentity && (
        <div className="rounded-md border border-primary/25 bg-primary/5 p-3">
          <p className="text-sm font-semibold">Which car are you posting as?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {carIdentityNote ?? "This puts your post with the right owners and car discussions."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Choose your car">
            {garageCars.map((car) => {
              const selected = car.id === selectedGarageCarId;
              return (
                <button
                  key={car.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setSelectedGarageCarId(car.id);
                    onGarageCarSelected?.(car.id);
                  }}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                >
                  <CarLogo
                    make={car.make}
                    className="size-5 shrink-0 rounded-full bg-white p-0.5"
                  />
                  {car.nickname}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {tagging &&
        !requiredCarIdentity &&
        (diagnosticsOn ? (
          <CarTagFields value={carTag} onChange={setCarTag} />
        ) : (
          <CarPicker value={carId} onChange={setCarId} id="composer-car" />
        ))}

      {video && (
        <div className="relative overflow-hidden rounded-md bg-black">
          <video
            src={video.previewUrl}
            controls
            playsInline
            className="max-h-64 w-full object-contain"
          />
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(video.previewUrl);
              setVideo(null);
            }}
            aria-label="Remove video"
            title="Remove video"
            className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full border border-white/70 bg-black/75 text-white shadow-md backdrop-blur hover:bg-destructive"
          >
            <X className="size-4" strokeWidth={3} />
          </button>
        </div>
      )}

      {pollOptions && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-xs font-semibold text-muted-foreground">Poll options</p>
          {pollOptions.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={option}
                onChange={(e) =>
                  setPollOptions((prev) =>
                    prev ? prev.map((o, i) => (i === index ? e.target.value : o)) : prev,
                  )
                }
                maxLength={80}
                placeholder={`Option ${index + 1}`}
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
              {pollOptions.length > 2 && (
                <button
                  type="button"
                  onClick={() =>
                    setPollOptions((prev) => (prev ? prev.filter((_, i) => i !== index) : prev))
                  }
                  aria-label={`Remove option ${index + 1}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between">
            {pollOptions.length < MAX_POLL_OPTIONS ? (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => (prev ? [...prev, ""] : prev))}
                className="text-xs font-medium text-primary"
              >
                + Add option
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setPollOptions(null)}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Remove poll
            </button>
          </div>
        </div>
      )}

      {spotting && (
        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold">Spotted a car? Link the owner's car (optional)</p>
          {spottedCar ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{spottedCar.label}</span>
              <button
                type="button"
                onClick={() => setSpottedCar(null)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                value={spotSearch}
                onChange={(e) => setSpotSearch(e.target.value)}
                placeholder="Search by car name, make or model"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
              {spotResults && spotResults.length > 0 && (
                <ul className="max-h-48 overflow-y-auto rounded-md border border-border bg-background">
                  {spotResults.map((car) => (
                    <li key={car.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setSpottedCar({
                            id: car.id,
                            label: `${displayUsernameWithoutAt(car.profiles?.username)}'s ${car.nickname} (${car.make} ${car.model})`,
                          })
                        }
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <CarLogo make={car.make} className="size-4" />
                        <span>
                          {car.nickname}{" "}
                          <span className="text-muted-foreground">
                            · {car.make} {car.model} ·{" "}
                            {displayUsernameWithoutAt(car.profiles?.username)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <p className="text-[11px] text-muted-foreground">
            The owner gets a notification and your post links to their garage.
          </p>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <div
              key={img.previewUrl}
              className="group relative aspect-square overflow-hidden rounded-md bg-muted"
            >
              <img src={img.previewUrl} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label={`Remove photo ${i + 1}`}
                title="Remove photo"
                className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full border border-white/70 bg-black/75 text-white shadow-md backdrop-blur hover:bg-destructive"
              >
                <X className="size-4" strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Tap Post to choose where this appears — Discussion, Diagnostics, Showcase and more.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {!requiredCarIdentity && (
          <button
            type="button"
            onClick={() =>
              user
                ? setTagging((v) => !v)
                : openAuthModal("Create a free account to post to the feed.")
            }
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {tagging ? "Remove car tag" : "+ Tag a car"}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />
        <button
          type="button"
          onClick={() =>
            user
              ? fileInputRef.current?.click()
              : openAuthModal("Create a free account to post to the feed.")
          }
          disabled={images.length >= MAX_IMAGES_PER_POST}
          title="Add photos"
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <ImagePlus className="size-5" />
        </button>
        {canAddVideo && (
          <>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={handleVideoSelected}
            />
            <button
              type="button"
              onClick={() =>
                user
                  ? videoInputRef.current?.click()
                  : openAuthModal("Create a free account to post to the feed.")
              }
              disabled={!!video}
              title="Add a video (up to 50MB)"
              aria-label="Add a video"
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <Video className="size-5" />
            </button>
          </>
        )}
        {social && (
          <button
            type="button"
            onClick={() =>
              user
                ? setPollOptions((prev) => (prev ? null : ["", ""]))
                : openAuthModal("Create a free account to post to the feed.")
            }
            title="Add a poll"
            aria-label="Add a poll"
            className={`flex size-9 items-center justify-center rounded-full hover:bg-accent hover:text-foreground ${pollOptions ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
          >
            <BarChart3 className="size-5" />
          </button>
        )}
        {social && !lockedGroup && audience === "public" && (
          <button
            type="button"
            onClick={() =>
              user
                ? setSpotting((v) => !v)
                : openAuthModal("Create a free account to post to the feed.")
            }
            title="Spotted a car"
            aria-label="Spotted a car"
            className={`flex size-9 items-center justify-center rounded-full hover:bg-accent hover:text-foreground ${spotting ? "bg-amber-600/10 text-amber-600" : "text-muted-foreground"}`}
          >
            <Eye className="size-5" />
          </button>
        )}
        <button
          type="submit"
          disabled={saving || !body.trim() || !pollReady || (requiredCarIdentity && !postingAs)}
          className="ml-auto rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Posting…" : "Post"}
        </button>
      </div>

      <Dialog
        open={categoryOpen}
        onOpenChange={(open) => {
          if (saving) return;
          setCategoryOpen(open);
          if (!open && !helpPost) setIssueStep(false);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl p-4 sm:max-w-md sm:p-6">
          {issueStep ? (
            <>
              <DialogHeader className="pr-7 text-left">
                <DialogTitle>Which part of the car?</DialogTitle>
                <DialogDescription>
                  One tap — it helps owners with the same problem find your post and its fix.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2">
                {ISSUE_SYSTEMS.map((system) => (
                  <button
                    key={system.id}
                    type="button"
                    disabled={saving}
                    onClick={() => void publishPost("diagnostics", system.id)}
                    className="flex items-center rounded-xl border border-border p-3 text-left text-sm font-medium transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
                  >
                    {system.label}
                  </button>
                ))}
              </div>
              {!helpPost && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIssueStep(false)}
                  className="text-left text-xs text-muted-foreground underline"
                >
                  ← Back to categories
                </button>
              )}
            </>
          ) : (
            <>
              <DialogHeader className="pr-7 text-left">
                <DialogTitle>Choose a category</DialogTitle>
                <DialogDescription>Where should this post appear?</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                {(
                  Object.entries(POST_CATEGORY_LABELS).filter(
                    ([id]) => id !== "for_sale" && (social || id !== "spotted"),
                  ) as [ComposerCategory, string][]
                ).map(([value, label]) => {
                  const Icon = CATEGORY_DETAILS[value].icon;
                  const isPublishing = saving && publishingCategory === value;
                  // Build Showcase is for showing the car off, so it needs a picture.
                  const needsPhoto = value === "showcase" && images.length === 0 && !video;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={saving || needsPhoto}
                      onClick={() =>
                        value === "diagnostics" && diagnosticsOn
                          ? setIssueStep(true)
                          : void publishPost(value)
                      }
                      className="flex items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {isPublishing ? "Posting…" : label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {needsPhoto
                            ? "Add a photo first — showcases need one"
                            : CATEGORY_DETAILS[value].description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}

/** Text with #tags and @mentions wrapped in highlight marks (for the mirror layer). */
function highlightTags(text: string) {
  const parts: React.ReactNode[] = [];
  const pattern = /(^|[^A-Za-z0-9_&])([#@][A-Za-z0-9_.]{1,40})/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const start = match.index + match[1]!.length;
    parts.push(text.slice(last, start));
    parts.push(
      <mark key={start} className="rounded bg-primary/15 text-transparent">
        {match[2]}
      </mark>,
    );
    last = start + match[2]!.length;
  }
  parts.push(text.slice(last));
  // A trailing newline needs a character after it to take up space.
  parts.push("\u200b");
  return parts;
}
