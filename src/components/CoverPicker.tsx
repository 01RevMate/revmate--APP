import { useRef, useState } from "react";
import { Camera, Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadImage, validateImageFile } from "@/lib/uploads";

export type CoverSuggestionGroup = { title: string; options: { url: string; label: string }[] };

/**
 * A full-width cover picker: upload your own photo, or tap one of the
 * suggestions (covers you've used before, ready-made designs).
 */
export function CoverPicker({
  label = "Cover image",
  hint,
  userId,
  value,
  onChange,
  suggestions = [],
  aspectClass = "aspect-[16/9]",
  fallback,
}: {
  label?: string;
  hint?: string;
  userId: string;
  value: string;
  onChange: (url: string) => void;
  suggestions?: CoverSuggestionGroup[];
  aspectClass?: string;
  /** What shows behind "Add a cover" when nothing is picked. */
  fallback?: React.ReactNode;
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
    <div className="space-y-2">
      <span className="block text-sm font-medium">{label}</span>
      <div
        className={`relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-slate-800 via-slate-900 to-black ${aspectClass}`}
      >
        {value ? <img src={value} alt="" className="size-full object-cover" /> : fallback}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm font-semibold text-white transition-colors ${value ? "opacity-0 hover:bg-black/40 hover:opacity-100 focus-visible:bg-black/40 focus-visible:opacity-100" : "bg-black/35"}`}
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : value ? (
            <Camera className="size-6" />
          ) : (
            <ImagePlus className="size-6" />
          )}
          {uploading ? "Uploading…" : value ? "Change cover" : "Upload your own photo"}
        </button>
        {value && !uploading && (
          <div className="absolute bottom-2 right-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur"
            >
              Upload
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
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {suggestions
        .filter((group) => group.options.length > 0)
        .map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden">
              {group.options.map((option) => {
                const selected = option.url === value;
                return (
                  <button
                    key={option.url}
                    type="button"
                    onClick={() => onChange(option.url)}
                    aria-pressed={selected}
                    title={option.label}
                    className={`relative w-28 shrink-0 overflow-hidden rounded-lg border-2 text-left ${selected ? "border-primary" : "border-transparent"}`}
                  >
                    <img
                      src={option.url}
                      alt=""
                      loading="lazy"
                      className="aspect-[16/9] w-full object-cover"
                    />
                    <span className="block truncate bg-card px-1.5 py-1 text-[11px] font-medium">
                      {option.label}
                    </span>
                    {selected && (
                      <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
