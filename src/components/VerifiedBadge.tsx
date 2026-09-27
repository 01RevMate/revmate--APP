import { useQuery } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { useSocialFeatures } from "@/lib/features";
import { fetchVerifiedProfiles, VERIFIED_LABELS, type VerifiedType } from "@/lib/social";

const BADGE_COLOURS: Record<VerifiedType, string> = {
  club: "text-violet-500",
  trader: "text-emerald-500",
  creator: "text-sky-500",
};

export function useVerifiedProfiles() {
  const enabled = useSocialFeatures();
  const { data } = useQuery({
    queryKey: ["verified-profiles"],
    queryFn: fetchVerifiedProfiles,
    enabled,
    staleTime: 5 * 60_000,
  });
  return data;
}

/** Blue-tick style badge for verified clubs, traders and creators. */
export function VerifiedBadge({
  userId,
  className = "size-3.5",
}: {
  userId: string | null | undefined;
  className?: string;
}) {
  const verified = useVerifiedProfiles();
  const type = userId ? verified?.get(userId) : undefined;
  if (!type) return null;
  return (
    <BadgeCheck
      className={`inline-block shrink-0 align-[-2px] ${BADGE_COLOURS[type]} ${className}`}
      aria-label={VERIFIED_LABELS[type]}
    >
      <title>{VERIFIED_LABELS[type]}</title>
    </BadgeCheck>
  );
}
