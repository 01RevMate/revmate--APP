import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useProfile } from "@/hooks/useProfile";
import {
  attachImagesToPost,
  createPost,
  uploadPostImage,
  MAX_IMAGES_PER_POST,
  POST_CATEGORY_LABELS,
  type Post,
} from "@/lib/posts";
import { validateImageFile } from "@/lib/uploads";
import { fetchGarage } from "@/lib/garage";
import { CarPicker } from "@/components/CarPicker";

export function PostComposer({ onPosted }: { onPosted: () => void }) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const { data: profile } = useProfile();
  const [body, setBody] = useState("");
  const [carId, setCarId] = useState("");
  const [tagging, setTagging] = useState(false);
  const [postingAs, setPostingAs] = useState("");
  const [category, setCategory] = useState<Post["category"]>("discussion");
  const [images, setImages] = useState<{ file: File; previewUrl: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: garage } = useQuery({
    queryKey: ["garage", user?.id],
    enabled: !!user,
    queryFn: () => fetchGarage(user!.id),
  });

  // Default new posts to whatever identity the person picked in their garage
  // ("Posting as ..."), but only once we know it — don't stomp a mid-post pick.
  useEffect(() => {
    if (postingAs === "" && profile?.active_garage_car_id) {
      setPostingAs(profile.active_garage_car_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.active_garage_car_id]);

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
    setSaving(true);
    try {
      const postId = await createPost({
        userId: user.id,
        body: body.trim(),
        carId: carId || undefined,
        postedAsGarageCarId: postingAs || undefined,
        category,
      });
      if (images.length > 0) {
        const urls = await Promise.all(images.map((img) => uploadPostImage(user.id, img.file)));
        await attachImagesToPost(postId, urls);
      }
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
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => !user && openAuthModal("Create a free account to post to the feed.")}
        placeholder="What are you working on?"
        rows={3}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {tagging && <CarPicker value={carId} onChange={setCarId} id="composer-car" />}

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <div key={img.previewUrl} className="group relative aspect-square overflow-hidden rounded-md bg-muted">
              <img src={img.previewUrl} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
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
        <button
          type="button"
          onClick={() => (user ? setTagging((v) => !v) : openAuthModal("Create a free account to post to the feed."))}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {tagging ? "Remove car tag" : "+ Tag a car"}
        </button>
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
            user ? fileInputRef.current?.click() : openAuthModal("Create a free account to post to the feed.")
          }
          disabled={images.length >= MAX_IMAGES_PER_POST}
          title="Add photos"
          className="text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <ImagePlus className="size-4" />
        </button>
        {garage && garage.length > 0 && (
          <select
            value={postingAs}
            onChange={(e) => setPostingAs(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="">Posting as {profile?.username ?? "you"}</option>
            {garage.map((car) => (
              <option key={car.id} value={car.id}>
                Posting as {car.nickname}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={saving || !body.trim()}
          className="ml-auto rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
