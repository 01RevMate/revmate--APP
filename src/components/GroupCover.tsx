import { Users } from "lucide-react";
import { CarLogo } from "@/components/CarLogo";
import { CoverPicker } from "@/components/CoverPicker";

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
