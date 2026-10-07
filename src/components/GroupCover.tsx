import { useRef, useState } from "react";
import { Loader2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { CarLogo } from "@/components/CarLogo";
import { CoverPicker } from "@/components/CoverPicker";
import { uploadImage, validateImageFile } from "@/lib/uploads";

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
            <CarLogo make={makeName} bare className="size-14 brightness-0 invert" />
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
}: {
  userId: string;
  value: string;
  onChange: (url: string) => void;
  makeName?: string | null | undefined;
}) {
  return (
    <CoverPicker
      userId={userId}
      value={value}
      onChange={onChange}
      aspectClass="aspect-[3/1]"
      hint="Wide photos work best (about 3:1). A shot of members' cars at a meet is perfect."
    />
  );
}

/**
 * A group's icon: its own uploaded picture, else the car brand's logo, else a
 * generic group symbol. Always on a white tile so any logo shows up.
 */
export function GroupIcon({
  iconUrl,
  makeName,
  className = "size-11",
}: {
  iconUrl?: string | null | undefined;
  makeName?: string | null | undefined;
  className?: string;
}) {
  if (iconUrl) {
    return (
      <span
        className={`${className} block shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-black/10`}
      >
        <img src={iconUrl} alt="" className="size-full object-cover" />
      </span>
    );
  }
  if (makeName) {
    return (
      <span
        className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-black/10`}
      >
        <CarLogo make={makeName} bare className="size-[72%]" />
      </span>
    );
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-border`}
    >
      <Users className="size-1/2" />
    </span>
  );
}

/** Choose the group icon: the car logo (if the group has a make) or a picture. */
export function GroupIconPicker({
  userId,
  value,
  onChange,
  makeName,
}: {
  userId: string;
  /** "" = automatic (car logo, or the generic icon). */
  value: string;
  onChange: (url: string) => void;
  makeName?: string | null | undefined;
}) {
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

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
      toast.error(err instanceof Error ? err.message : "Couldn't upload that picture");
    } finally {
      setUploading(false);
    }
  }

  const option = (active: boolean) =>
    `flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold ${
      active ? "bg-foreground text-background" : "bg-muted text-foreground"
    }`;

  return (
    <div className="flex items-center gap-4">
      <GroupIcon iconUrl={value || null} makeName={makeName} className="size-16" />
      <div className="flex flex-1 flex-wrap gap-2">
        <button type="button" onClick={() => onChange("")} className={option(!value)}>
          {makeName ? "Car logo" : "Default"}
        </button>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading}
          className={option(!!value)}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {value ? "Change picture" : "Upload picture"}
        </button>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} />
      </div>
    </div>
  );
}
