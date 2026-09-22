import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { uploadImage, validateImageFile } from "@/lib/uploads";

export function EditableImage({
  userId,
  editable,
  onUploaded,
  className,
  rounded = "rounded-full",
  label,
  children,
}: {
  userId: string;
  editable: boolean;
  onUploaded: (url: string) => void;
  className?: string;
  rounded?: string;
  label?: string;
  children: React.ReactNode;
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
      onUploaded(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload image");
    } finally {
      setUploading(false);
    }
  }

  if (!editable) return <div className={className}>{children}</div>;

  return (
    <div className={`group relative ${className ?? ""}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelected}
      />
      {children}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={uploading ? "Uploading image" : label ?? "Change image"}
        title={label ?? "Change image"}
        className={`
          absolute flex cursor-pointer items-center justify-center
          transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:pointer-events-auto
          disabled:cursor-wait
          md:inset-0 md:flex-col md:gap-1.5 md:bg-black/45 md:text-white md:opacity-0 md:group-hover:opacity-100 md:pointer-events-none md:group-hover:pointer-events-auto
          max-md:bottom-3 max-md:right-3 max-md:gap-1.5 max-md:rounded-full max-md:border max-md:border-border/60 max-md:bg-background/95
          max-md:px-3 max-md:py-2 max-md:text-foreground max-md:shadow-lg max-md:opacity-100
          ${rounded}
        `}
      >
        {uploading ? (
          <Loader2 className="size-6 animate-spin md:size-8" />
        ) : (
          <>
            <Camera className="size-6 md:size-8" />
            {label ? (
              <>
                <span className="hidden text-sm font-semibold md:inline">{label}</span>
                <span className="text-xs font-medium md:hidden">{label}</span>
              </>
            ) : null}
          </>
        )}
      </button>
    </div>
  );
}
