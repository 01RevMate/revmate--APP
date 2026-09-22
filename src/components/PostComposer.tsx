import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useProfile } from "@/hooks/useProfile";
import {
  attachImagesToPost,
  createPost,
  uploadPostImage,
  uploadGroupPostImage,
  deletePost,
  MAX_IMAGES_PER_POST,
  POST_CATEGORY_LABELS,
  type Post,
} from "@/lib/posts";
import { validateImageFile } from "@/lib/uploads";
import { CarPicker } from "@/components/CarPicker";
import { CarLogo } from "@/components/CarLogo";
import type { GarageCar } from "@/lib/garage";

export function PostComposer({
  onPosted,
  lockedGroup,
  requiredCarIdentity = false,
  garageCars = [],
  preferredGarageCarId = null,
  onGarageCarSelected,
}: {
  onPosted: () => void;
  lockedGroup?: { id: string; name: string; postPolicy: "member" | "moderated" };
  requiredCarIdentity?: boolean;
  garageCars?: GarageCar[];
  preferredGarageCarId?: string | null;
  onGarageCarSelected?: (garageCarId: string) => void;
}) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const { data: profile } = useProfile();
  const [body, setBody] = useState("");
  const [carId, setCarId] = useState("");
  const [tagging, setTagging] = useState(false);
  const [selectedGarageCarId, setSelectedGarageCarId] = useState("");
  const [category, setCategory] = useState<Post["category"]>("discussion");
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
    setCategory("discussion");
    setImages([]);
  }

  async function handleSubmit(e: React.FormEvent) {
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
    setSaving(true);
    try {
      const postId = await createPost({
        userId: user.id,
        body: body.trim(),
        carId: carId || undefined,
        postedAsGarageCarId: postingAs || undefined,
        category,
        groupId: lockedGroup?.id,
      });
      if (images.length > 0) {
        try {
          const urls = await Promise.all(
            images.map((img) =>
              lockedGroup
                ? uploadGroupPostImage(user.id, postId, img.file)
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
          : "Post published.",
      );
      resetForm();
      onPosted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post");
    } finally {
      setSaving(false);
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
          <label htmlFor="posting-car" className="text-xs font-semibold">
            Choose which car you’re posting as
          </label>
          <select
            id="posting-car"
            value={selectedGarageCarId}
            onChange={(e) => {
              setSelectedGarageCarId(e.target.value);
              if (e.target.value) onGarageCarSelected?.(e.target.value);
            }}
            required
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select one of your cars</option>
            {garageCars.map((car) => (
              <option key={car.id} value={car.id}>
                {car.nickname} — {car.make} {car.model}
              </option>
            ))}
          </select>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            {postingAs && (
              <CarLogo
                make={garageCars.find((car) => car.id === postingAs)?.make ?? ""}
                className="size-4 rounded-full"
              />
            )}
            Use your profile in All Cars or groups. Choose an owned car for the car feeds.
          </p>
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
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Post["category"])}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
        >
          {Object.entries(POST_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
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
    </form>
  );
}
