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

export async function uploadImage(bucket: "post-images" | "user-media", userId: string, file: File): Promise<string> {
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
