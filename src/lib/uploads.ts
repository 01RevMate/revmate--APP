import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Client-side guardrails matching the storage buckets' server-side
// file_size_limit / allowed_mime_types (drizzle/migrations/0008, 0010) —
// this just gives instant feedback; the server enforces the real limit
// regardless of what the browser sends.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `${file.name} isn't a supported image type.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name} is over ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`;
  }
  return null;
}

export async function uploadImage(
  bucket: "post-images" | "user-media",
  userId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Cropped output always arrives as a JPEG blob, so phone-camera formats
// (HEIC and friends) never reach storage.
export async function uploadImageBlob(
  bucket: "post-images" | "user-media",
  userId: string,
  blob: Blob,
): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: "image/jpeg" });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Looks at a picture the person just chose and warns, without blocking, when it
 * is likely to look wrong: too small or blurry, a very heavy file, or an odd
 * shape that grids and thumbnails will crop. Call it after validateImageFile.
 */
export function warnAboutImage(file: File): void {
  if (typeof window === "undefined" || file.type === "image/gif") return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const { naturalWidth: w, naturalHeight: h } = img;
    const shortSide = Math.min(w, h);
    const ratio = w / h;
    const warnings: string[] = [];
    if (shortSide < 400) {
      warnings.push(`is very small (${w}×${h}) and will look blurry. Use a larger photo.`);
    } else if (shortSide < 800) {
      warnings.push(`is on the small side (${w}×${h}) and may look soft on big screens.`);
    }
    if (Math.max(w, h) > 6000) {
      warnings.push(`is huge (${w}×${h}) and will load slowly. A smaller export is fine.`);
    } else if (file.size > 4 * 1024 * 1024) {
      warnings.push(
        `is a heavy file (${(file.size / (1024 * 1024)).toFixed(1)}MB) and will load slowly.`,
      );
    }
    if (ratio > 2.2 || ratio < 0.55) {
      warnings.push("has an unusual shape and may be cropped in thumbnails and grids.");
    }
    for (const warning of warnings) toast.warning(`${file.name} ${warning}`, { duration: 7000 });
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}
