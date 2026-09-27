import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { castPollVote, fetchPoll, removePollVote } from "@/lib/social";

/** Poll attached to a post: tap to vote, tap again to take it back. */
export function PostPoll({ postId }: { postId: string }) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const queryKey = ["poll", postId, user?.id];
  const { data } = useQuery({ queryKey, queryFn: () => fetchPoll(postId, user?.id) });

  if (!data || data.options.length < 2) return null;
  const { options, myOptionId } = data;
  const total = options.reduce((sum, option) => sum + option.votes_count, 0);
  const showResults = !!myOptionId;
  const hasImages = options.some((option) => option.image_url);

  async function vote(optionId: string) {
    if (!user) return openAuthModal("Create a free account to vote.");
    if (busy) return;
    setBusy(true);
    try {
      if (optionId === myOptionId) await removePollVote(postId, user.id);
      else await castPollVote(postId, optionId, user.id, !!myOptionId);
      await queryClient.invalidateQueries({ queryKey: ["poll", postId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your vote");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className={hasImages ? "grid grid-cols-2 gap-2" : "space-y-2"}>
        {options.map((option) => {
          const percent = total > 0 ? Math.round((option.votes_count / total) * 100) : 0;
          const mine = option.id === myOptionId;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => vote(option.id)}
              disabled={busy}
              className={`relative w-full overflow-hidden rounded-md border text-left text-sm transition-colors disabled:opacity-70 ${mine ? "border-primary" : "border-border hover:border-foreground/40"}`}
            >
              {option.image_url && (
                <img
                  src={option.image_url}
                  alt={option.label}
                  className="aspect-square w-full object-cover"
                />
              )}
              <div className="relative px-3 py-2">
                {showResults && (
                  <div
                    aria-hidden
                    className={`absolute inset-y-0 left-0 ${mine ? "bg-primary/15" : "bg-muted"}`}
                    style={{ width: `${percent}%` }}
                  />
                )}
                <span className="relative flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    {mine && <Check className="size-3.5 text-primary" />}
                    {option.label}
                  </span>
                  {showResults && (
                    <span className="tabular-nums text-muted-foreground">{percent}%</span>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {total} {total === 1 ? "vote" : "votes"}
        {showResults
          ? " · tap your choice again to remove your vote"
          : " · vote to see the results"}
      </p>
    </div>
  );
}
