import { Gem } from "lucide-react";
import { usePlusMember } from "@/lib/money";

/** Small "Plus" pill on a supporter's profile page. */
export function PlusBadge({ userId }: { userId: string | null | undefined }) {
  const plus = usePlusMember(userId);
  if (!plus) return null;
  return (
    <span
      className="ml-1.5 mt-1.5 inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300"
      title="Supports RevMate with Plus"
    >
      <Gem className="size-3.5" /> Plus
    </span>
  );
}
