import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, UserPlus } from "lucide-react";
import {
  acceptFriendRequest,
  fetchFriendshipBetween,
  removeFriendship,
  sendFriendRequest,
} from "@/lib/friends";

export function FriendButton({ myId, otherId }: { myId: string; otherId: string }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: friendship } = useQuery({
    queryKey: ["friendship", myId, otherId],
    queryFn: () => fetchFriendshipBetween(myId, otherId),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["friendship", myId, otherId] });
  }

  async function handleSend() {
    setBusy(true);
    try {
      await sendFriendRequest(myId, otherId);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send request");
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept() {
    if (!friendship) return;
    setBusy(true);
    try {
      await acceptFriendRequest(friendship.id);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't accept request");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!friendship) return;
    setBusy(true);
    try {
      await removeFriendship(friendship.id);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update friendship");
    } finally {
      setBusy(false);
    }
  }

  const baseClass = "flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium";

  if (!friendship) {
    return (
      <button onClick={handleSend} disabled={busy} className={`${baseClass} hover:bg-accent disabled:opacity-50`}>
        <UserPlus className="size-3.5" />
        Add Friend
      </button>
    );
  }

  if (friendship.status === "accepted") {
    return (
      <button onClick={handleRemove} disabled={busy} className={`${baseClass} hover:bg-accent disabled:opacity-50`}>
        <Check className="size-3.5 text-primary" />
        Friends
      </button>
    );
  }

  if (friendship.requester_id === myId) {
    return (
      <button disabled className={`${baseClass} text-muted-foreground`}>
        <Clock className="size-3.5" />
        Pending
      </button>
    );
  }

  return (
    <button onClick={handleAccept} disabled={busy} className={`${baseClass} bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50`}>
      <Check className="size-3.5" />
      Accept
    </button>
  );
}
