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
    <label className={`group relative block cursor-pointer ${className ?? ""}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelected}
      />
      {children}
      <div
        className={`absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 ${rounded}`}
      >
        {uploading ? (
          <Loader2 className="size-5 animate-spin text-white" />
        ) : (
          <Camera className="size-5 text-white" />
        )}
      </div>
    </label>
  );
}
