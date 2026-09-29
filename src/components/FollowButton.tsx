import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { fetchIsFollowing, followProfile, unfollowProfile } from "@/lib/follows";

export function FollowButton({
  myId,
  otherId,
  variant = "button",
}: {
  myId: string;
  otherId: string;
  /** "link" is a small blue text link — for inline use like a post header. */
  variant?: "button" | "link";
}) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data: following = false } = useQuery({
    queryKey: ["profile-follow", myId, otherId],
    queryFn: () => fetchIsFollowing(myId, otherId),
  });

  async function toggle() {
    setBusy(true);
    try {
      if (following) await unfollowProfile(myId, otherId);
      else await followProfile(myId, otherId);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["profile-follow", myId, otherId] }),
        client.invalidateQueries({ queryKey: ["social-counts"] }),
        client.invalidateQueries({ queryKey: ["followers"] }),
        client.invalidateQueries({ queryKey: ["following"] }),
        client.invalidateQueries({ queryKey: ["feed"] }),
      ]);
      toast.success(following ? "Unfollowed." : "Following.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this follow");
    } finally {
      setBusy(false);
    }
  }

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void toggle();
        }}
        disabled={busy}
        className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
      >
        {following ? "Following" : "Follow"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${
        following
          ? "border border-input bg-background hover:bg-accent"
          : "bg-primary text-primary-foreground hover:bg-primary/90"
      }`}
    >
      {following ? <Check className="size-3.5" /> : <UserPlus className="size-3.5" />}
      {following ? "Following" : "Follow"}
    </button>
  );
}
