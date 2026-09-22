import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { uploadImageBlob } from "@/lib/uploads";
import { ImageCropperDialog } from "@/components/ImageCropperDialog";

const MAX_RAW_BYTES = 25 * 1024 * 1024; // raw camera-roll file, before cropping

export function EditableImage({
  userId,
  editable,
  onUploaded,
  className,
  rounded = "rounded-full",
  label,
  showTrigger = true,
  aspect = 1,
  circular = false,
  cropTitle,
  successMessage = "Photo updated.",
  children,
}: {
  userId: string;
  editable: boolean;
  onUploaded: (url: string) => void | Promise<void>;
  className?: string;
  rounded?: string;
  label?: string;
  showTrigger?: boolean;
  aspect?: number;
  circular?: boolean;
  cropTitle?: string;
  successMessage?: string;
  children: React.ReactNode;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      toast.error("That file isn't an image.");
      return;
    }
    if (picked.size > MAX_RAW_BYTES) {
      toast.error("That photo is too large. Please pick one under 25MB.");
      return;
    }
    setFile(picked);
  }

  async function handleConfirm(blob: Blob) {
    setSaving(true);
    try {
      const url = await uploadImageBlob("user-media", userId, blob);
      await onUploaded(url);
      toast.success(successMessage);
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload that photo. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleFileSelected}
    />
  );

  const cropper = (
    <ImageCropperDialog
      open={!!file}
      file={file}
      aspect={aspect}
      circular={circular}
      title={cropTitle ?? label ?? "Adjust photo"}
      saving={saving}
      onCancel={() => setFile(null)}
      onConfirm={handleConfirm}
      onPickAnother={() => {
        setFile(null);
        setTimeout(() => inputRef.current?.click(), 50);
      }}
    />
  );

  if (!editable || !showTrigger)
    return (
      <div className={className}>
        {children}
        {picker}
        {cropper}
      </div>
    );

  return (
    <div className={`group relative ${className ?? ""}`}>
      {picker}
      {children}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={label ?? "Change image"}
        title={label ?? "Change image"}
        className={`
          absolute flex cursor-pointer items-center justify-center
          transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:pointer-events-auto
          md:inset-0 md:flex-col md:gap-1.5 md:bg-black/45 md:text-white md:opacity-0 md:group-hover:opacity-100 md:pointer-events-none md:group-hover:pointer-events-auto
          max-md:bottom-3 max-md:right-3 max-md:gap-1.5 max-md:rounded-full max-md:border max-md:border-border/60 max-md:bg-background/95
          max-md:px-3 max-md:py-2 max-md:text-foreground max-md:shadow-lg max-md:opacity-100
          ${rounded}
        `}
      >
        <Camera className="size-6 md:size-8" />
        {label ? (
          <>
            <span className="hidden text-sm font-semibold md:inline">{label}</span>
            <span className="text-xs font-medium md:hidden">{label}</span>
          </>
        ) : null}
      </button>
      {cropper}
    </div>
  );
}
