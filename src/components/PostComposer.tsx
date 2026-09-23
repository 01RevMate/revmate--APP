import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Gauge,
  ImagePlus,
  MessagesSquare,
  Paintbrush,
  Sparkles,
  Stethoscope,
  UserRoundCheck,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
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
import { CarPicker } from "@/components/CarPicker";
import { CarLogo } from "@/components/CarLogo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GarageCar } from "@/lib/garage";

const CATEGORY_DETAILS = {
  discussion: { icon: MessagesSquare, description: "General car chat and opinions" },
  diagnostics: { icon: Stethoscope, description: "Faults, warning lights and fixes" },
  modifications: { icon: Wrench, description: "Upgrades, tuning and changes" },
  bodywork: { icon: Paintbrush, description: "Paint, dents and body repairs" },
  maintenance: { icon: Gauge, description: "Servicing, upkeep and how-tos" },
  showcase: { icon: Sparkles, description: "Show everyone your car or build" },
} satisfies Record<Post["category"], { icon: typeof MessagesSquare; description: string }>;

export function PostComposer({
  onPosted,
  lockedGroup,
  requiredCarIdentity = false,
  garageCars = [],
  preferredGarageCarId = null,
  onGarageCarSelected,
  audience = "public",
}: {
  onPosted: () => void;
  lockedGroup?: { id: string; name: string; postPolicy: "member" | "moderated" };
  requiredCarIdentity?: boolean;
  garageCars?: GarageCar[];
  preferredGarageCarId?: string | null;
  onGarageCarSelected?: (garageCarId: string) => void;
  audience?: Post["audience"];
}) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const { data: profile } = useProfile();
  const [body, setBody] = useState("");
  const [carId, setCarId] = useState("");
  const [tagging, setTagging] = useState(false);
  const [selectedGarageCarId, setSelectedGarageCarId] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [publishingCategory, setPublishingCategory] = useState<Post["category"] | null>(null);
  const [images, setImages] = useState<{ file: File; previewUrl: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const postingAs = requiredCarIdentity
    ? selectedGarageCarId
    : (profile?.active_garage_car_id ?? "");

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

  function resetForm() {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setBody("");
    setCarId("");
    setTagging(false);
    setImages([]);
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
    setCategoryOpen(true);
  }

  async function publishPost(category: Post["category"]) {
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
      });
      if (images.length > 0) {
        try {
          const urls = await Promise.all(
            images.map((img) =>
              lockedGroup || audience === "friends"
                ? uploadProtectedPostImage(user.id, postId, img.file)
                : uploadPostImage(user.id, img.file),
            ),
          );
          await attachImagesToPost(postId, urls);
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
            ? "Friends-only post published."
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
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-card p-4">
      {lockedGroup && (
        <p className="text-xs font-medium text-primary">
          Posting in {lockedGroup.name} ·{" "}
          {lockedGroup.postPolicy === "moderated" ? "Posts may need approval" : "Group members"}
        </p>
      )}
      {!lockedGroup && audience === "friends" && (
        <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900">
          <UserRoundCheck className="size-4 shrink-0" />
          Friends only — only your accepted friends can see this post.
        </div>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => !user && openAuthModal("Create a free account to post to the feed.")}
        placeholder="What are you working on?"
        maxLength={10000}
        rows={3}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {requiredCarIdentity && (
        <div className="rounded-md border border-primary/25 bg-primary/5 p-3">
          <p className="text-sm font-semibold">Which car are you posting as?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This puts your post with the right owners and car discussions.
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
      {tagging && !requiredCarIdentity && (
        <CarPicker value={carId} onChange={setCarId} id="composer-car" />
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
          className="text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <ImagePlus className="size-4" />
        </button>
        <button
          type="submit"
          disabled={saving || !body.trim() || (requiredCarIdentity && !postingAs)}
          className="ml-auto rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Posting…" : "Post"}
        </button>
      </div>

      <Dialog
        open={categoryOpen}
        onOpenChange={(open) => {
          if (!saving) setCategoryOpen(open);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl p-4 sm:max-w-md sm:p-6">
          <DialogHeader className="pr-7 text-left">
            <DialogTitle>Choose a category</DialogTitle>
            <DialogDescription>Where should this post appear?</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {(Object.entries(POST_CATEGORY_LABELS) as [Post["category"], string][]).map(
              ([value, label]) => {
                const Icon = CATEGORY_DETAILS[value].icon;
                const isPublishing = saving && publishingCategory === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={saving}
                    onClick={() => void publishPost(value)}
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
                        {CATEGORY_DETAILS[value].description}
                      </span>
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
