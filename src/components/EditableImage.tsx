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
  children,
}: {
  userId: string;
  editable: boolean;
  onUploaded: (url: string) => void;
  className?: string;
  rounded?: string;
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
        aria-label={uploading ? "Uploading image" : "Change image"}
        title="Change image"
        className={`absolute inset-0 flex cursor-pointer items-center justify-center bg-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-wait max-md:inset-auto max-md:bottom-3 max-md:right-3 max-md:size-10 max-md:rounded-full max-md:bg-background/90 max-md:text-foreground max-md:opacity-100 max-md:shadow-md ${rounded}`}
      >
        {uploading ? (
          <Loader2 className="size-5 animate-spin text-primary-foreground max-md:text-foreground" />
        ) : (
          <Camera className="size-5 text-primary-foreground max-md:text-foreground" />
        )}
      </button>
    </div>
  );
}
