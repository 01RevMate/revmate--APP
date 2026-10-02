import { useState } from "react";
import { Loader2, Star, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { uploadImage, validateImageFile } from "@/lib/uploads";

/** Add, remove and choose the cover photo (the first one) for an advert. */
export function ListingPhotosEditor({
  userId,
  photos,
  onChange,
  max,
}: {
  userId: string;
  photos: string[];
  onChange: (photos: string[]) => void;
  max: number;
}) {
  const [uploading, setUploading] = useState(false);

  async function add(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = max - photos.length;
    const valid = files.filter((file) => {
      const problem = validateImageFile(file);
      if (problem) toast.error(problem);
      return !problem;
    });
    if (valid.length > room) toast.error(`Up to ${max} photos.`);
    const batch = valid.slice(0, Math.max(room, 0));
    if (!batch.length) return;
    setUploading(true);
    let next = photos;
    try {
      for (const file of batch) {
        try {
          next = [...next, await uploadImage("user-media", userId, file)];
          onChange(next);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Couldn't upload ${file.name}`);
        }
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">
          Photos ({photos.length}/{max})
        </span>
        {photos.length > 1 && (
          <span className="text-xs text-muted-foreground">Tap ★ to make it the cover</span>
        )}
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((url, i) => (
            <div key={url} className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
              <img src={url} alt="" className="size-full object-cover" />
              {i === 0 ? (
                <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  Cover
                </span>
              ) : (
                <button
                  type="button"
                  aria-label="Make this the cover photo"
                  onClick={() => onChange([url, ...photos.filter((p) => p !== url)])}
                  className="absolute left-1 top-1 rounded bg-black/60 p-1 text-white"
                >
                  <Star className="size-3" />
                </button>
              )}
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => onChange(photos.filter((p) => p !== url))}
                className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <label
        className={`inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium ${uploading || photos.length >= max ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent"}`}
      >
        {uploading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Upload className="size-3.5" />
        )}
        {uploading
          ? "Uploading…"
          : photos.length >= max
            ? `${max} photo limit reached`
            : "Add photos"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={add}
          disabled={uploading || photos.length >= max}
        />
      </label>
    </div>
  );
}
