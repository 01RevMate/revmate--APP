import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";
import { uploadImage, validateImageFile } from "@/lib/uploads";
import { Avatar } from "@/components/Avatar";

export function ImageUploadField({
  label,
  userId,
  value,
  onChange,
  shape = "square",
}: {
  label: string;
  userId: string;
  value: string;
  onChange: (url: string) => void;
  shape?: "square" | "wide";
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
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
      const url = await uploadImage("user-media", userId, file);
      onChange(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload image");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        {shape === "square" ? (
          <Avatar photoUrl={value || null} fallback={label} className="size-14" />
        ) : (
          <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
            {value && <img src={value} alt="" className="size-full object-cover" />}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileSelected}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {uploading ? "Uploading…" : value ? "Replace" : "Upload"}
        </button>
        {value && !uploading && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-muted-foreground hover:text-destructive"
            title="Remove"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
