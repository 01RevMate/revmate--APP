import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";
import { acceptFriendRequest, fetchFriends, fetchPendingRequests, removeFriendship } from "@/lib/friends";
import { Avatar } from "@/components/Avatar";

export function FriendsSection({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const { data: friends } = useQuery({
    queryKey: ["friends", userId],
    queryFn: () => fetchFriends(userId),
  });

  const { data: pending } = useQuery({
    queryKey: ["pending-requests", userId],
    queryFn: () => fetchPendingRequests(userId),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["friends", userId] });
    queryClient.invalidateQueries({ queryKey: ["pending-requests", userId] });
  }

  async function handleAccept(id: string) {
    try {
      await acceptFriendRequest(id);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't accept request");
    }
  }

  async function handleDecline(id: string) {
    try {
      await removeFriendship(id);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't decline request");
    }
  }

  return (
    <div>
      {pending && pending.length > 0 && (
        <div className="mb-4 space-y-2">
          {pending.map((req) => (
            <div key={req.id} className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <Avatar photoUrl={req.requester.avatar_url} fallback={req.requester.username} className="size-8" />
                <p className="text-sm">
                  <span className="font-medium">{req.requester.username}</span> wants to be friends
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => handleAccept(req.id)}
                  className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDecline(req.id)}
                  className="rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-accent"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {friends && friends.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {friends.map((f) => {
            const friend = f.requester_id === userId ? f.recipient : f.requester;
            return (
              <Link
                key={f.id}
                to="/u/$username"
                params={{ username: friend.username }}
                className="flex w-16 flex-col items-center gap-1 text-center"
              >
                <Avatar photoUrl={friend.avatar_url} fallback={friend.username} className="size-12" />
                <p className="w-full truncate text-[10px] text-muted-foreground">{friend.username}</p>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          <Users className="size-5 shrink-0" />
          No friends yet — visit another profile to add one.
        </div>
      )}
      {(!pending || pending.length === 0) && friends && friends.length === 0 && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <UserPlus className="size-3" /> Find people via car pages or the feed.
        </p>
      )}
    </div>
  );
}
