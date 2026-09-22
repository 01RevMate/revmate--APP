import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { displayUsernameWithoutAt } from "@/lib/usernames";

export function NotificationCenter() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const {
    data: notifications = [],
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "*, actor:profiles!notifications_actor_id_fkey(username), community_groups(slug, name)",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
  const unread = notifications.filter((n) => !n.read_at).length;
  async function markRead(id?: string) {
    let query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user!.id)
      .is("read_at", null);
    if (id) query = query.eq("id", id);
    const { error } = await query;
    if (error) toast.error("Could not mark notifications as read.");
    else await client.invalidateQueries({ queryKey: ["notifications"] });
  }
  async function remove(id: string) {
    setBusy(true);
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) toast.error("Could not remove notification.");
    else await client.invalidateQueries({ queryKey: ["notifications"] });
    setBusy(false);
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          className="relative flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(90vw,360px)] p-0">
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="font-semibold">Notifications</h2>
          <button
            onClick={() => markRead()}
            disabled={!unread}
            className="text-xs text-primary disabled:opacity-50"
          >
            Mark all read
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isLoading && <p className="p-4 text-sm">Loading notifications…</p>}
          {error && (
            <p role="alert" className="p-4 text-sm">
              Could not load notifications.{" "}
              <button onClick={() => refetch()} className="text-primary">
                Retry
              </button>
            </p>
          )}
          {!error && !isLoading && notifications.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Replies, likes and group updates will appear here.
            </p>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-center border-b p-3 ${n.read_at ? "" : "bg-primary/5"}`}
            >
              <Link
                to={n.post_id ? "/posts/$postId" : "/groups/$slug"}
                params={
                  n.post_id ? { postId: n.post_id } : { slug: n.community_groups?.slug ?? "" }
                }
                onClick={() => {
                  markRead(n.id);
                  setOpen(false);
                }}
                className="min-w-0 flex-1 text-sm"
              >
                <span className="font-medium">{displayUsernameWithoutAt(n.actor?.username, "A member")}</span>
                {n.kind === "comment"
                  ? " commented on your post"
                  : n.kind === "like"
                    ? " liked your post"
                    : n.kind === "join_request"
                      ? ` requested to join ${n.community_groups?.name ?? "your group"}`
                      : ` updated your membership in ${n.community_groups?.name ?? "a group"}`}
                .
              </Link>
              <button
                onClick={() => remove(n.id)}
                disabled={busy}
                aria-label="Dismiss notification"
                className="ml-2 rounded p-2 hover:bg-accent"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
