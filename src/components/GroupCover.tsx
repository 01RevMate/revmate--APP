import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { uploadImage, validateImageFile } from "@/lib/uploads";
import { CarLogo } from "@/components/CarLogo";

/** The banner across the top of a group (or a branded fallback). */
export function GroupCoverBanner({
  coverUrl,
  makeName,
  className = "aspect-[3/1]",
  plain = false,
}: {
  coverUrl: string | null | undefined;
  makeName?: string | null | undefined;
  className?: string;
  /** No placeholder logo (e.g. behind the upload prompt). */
  plain?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-black ${className}`}
    >
      {coverUrl ? (
        <img src={coverUrl} alt="" className="size-full object-cover" loading="lazy" />
      ) : plain ? null : (
        <div className="flex size-full items-center justify-center opacity-40">
          {makeName ? (
            <CarLogo make={makeName} className="size-14 brightness-0 invert" />
          ) : (
            <Users className="size-10 text-white" />
          )}
        </div>
      )}
    </div>
  );
}

/** Upload / replace / remove a group cover, with a full-width live preview. */
export function GroupCoverPicker({
  userId,
  value,
  onChange,
  makeName,
}: {
  userId: string;
  value: string;
  onChange: (url: string) => void;
  makeName?: string | null | undefined;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setUploading(true);
    try {
      onChange(await uploadImage("user-media", userId, file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload the cover");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium">Cover image</span>
      <div className="relative overflow-hidden rounded-xl border border-border">
        <GroupCoverBanner coverUrl={value || null} makeName={makeName} plain />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm font-semibold text-white transition-colors ${value ? "bg-black/0 opacity-0 hover:bg-black/40 hover:opacity-100 focus-visible:bg-black/40 focus-visible:opacity-100" : "bg-black/20"}`}
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : value ? (
            <Camera className="size-6" />
          ) : (
            <ImagePlus className="size-6" />
          )}
          {uploading ? "Uploading…" : value ? "Change cover" : "Add a cover image"}
        </button>
        {value && !uploading && (
          <div className="absolute bottom-2 right-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur"
            >
              Change
            </button>
            <button
              type="button"
              aria-label="Remove cover"
              onClick={() => onChange("")}
              className="rounded-full bg-black/60 p-1.5 text-white backdrop-blur"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={pick}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Wide photos work best (about 3:1). A shot of members' cars at a meet is perfect.
      </p>
    </div>
  );
}
