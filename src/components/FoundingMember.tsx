import { Link } from "@tanstack/react-router";
import { Award } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFoundingNumber, useFoundingSpotsLeft } from "@/lib/launch";

/** "Founding member #12" pill for the first 100 accounts. */
export function FoundingBadge({ userId }: { userId: string | null | undefined }) {
  const number = useFoundingNumber(userId);
  if (!number) return null;
  return (
    <span
      className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
      title="One of the first 100 people to join RevMate"
    >
      <Award className="size-3.5" /> Founding member #{number}
    </span>
  );
}

/** One line for the sign-up page while founding spots are left. */
export function FoundingSpotsNote() {
  const left = useFoundingSpotsLeft();
  if (!left) return null;
  return (
    <p className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
      <Award className="size-4 shrink-0" />
      Join now to get a Founding member badge. {left} {left === 1 ? "spot" : "spots"} left.
    </p>
  );
}

/** Invite for signed-out visitors while founding spots are left. */
export function FoundingSpotsBanner() {
  const { user } = useAuth();
  const left = useFoundingSpotsLeft();
  if (user || !left) return null;
  return (
    <Link
      to="/signup"
      className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 hover:bg-amber-500/15"
    >
      <Award className="size-8 shrink-0 text-amber-600 dark:text-amber-300" />
      <div className="min-w-0">
        <p className="font-semibold">Be one of the first 100 members</p>
        <p className="text-sm text-muted-foreground">
          Join free and keep a Founding member badge for good. {left}{" "}
          {left === 1 ? "spot" : "spots"} left.
        </p>
      </div>
    </Link>
  );
}
