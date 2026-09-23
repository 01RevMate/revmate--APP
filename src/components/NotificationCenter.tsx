import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Car,
  CheckCircle2,
  Heart,
  HelpCircle,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { displayUsernameWithoutAt } from "@/lib/usernames";
import type { Tables } from "@/integrations/supabase/types";

type NotificationWithContext = Tables<"notifications"> & {
  actor: Pick<Tables<"profiles">, "username"> | null;
  community_groups: Pick<Tables<"community_groups">, "slug" | "name"> | null;
};

function notificationDetails(notification: NotificationWithContext) {
  const actor = displayUsernameWithoutAt(notification.actor?.username, "A member");
  const group = notification.community_groups?.name ?? "the group";
  switch (notification.kind) {
    case "comment":
      return { Icon: MessageCircle, text: `${actor} commented on your post` };
    case "message":
      return {
        Icon: MessageCircle,
        text: `${actor} ${notification.message ?? "sent you a message"}`,
      };
    case "like":
      return { Icon: Heart, text: `${actor} liked your post` };
    case "friend_request":
      return { Icon: UserPlus, text: `${actor} sent you a friend request` };
    case "friend_accepted":
      return { Icon: CheckCircle2, text: `${actor} accepted your friend request` };
    case "car_like":
      return { Icon: Car, text: `${actor} liked a car in your garage` };
    case "answer":
      return { Icon: HelpCircle, text: `${actor} answered your question` };
    case "join_request":
      return { Icon: Users, text: `${actor} requested to join ${group}` };
    case "membership":
      return {
        Icon: Users,
        text: `${actor} ${notification.message ?? "updated your membership in"} ${group}`,
      };
    case "post_review":
      return {
        Icon: ShieldCheck,
        text: `${actor} ${notification.message ?? "reviewed your post in"} ${group}`,
      };
    case "app_update":
      return { Icon: Megaphone, text: notification.message ?? "There is a new RevMate update" };
    default:
      return { Icon: Bell, text: "You have a new RevMate notification" };
  }
}

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
    refetchInterval: 15000,
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
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => client.invalidateQueries({ queryKey: ["notifications", user.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [client, user]);
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
              Messages, replies, likes and group updates will appear here.
            </p>
          )}
          {(notifications as NotificationWithContext[]).map((n) => {
            const { Icon, text } = notificationDetails(n);
            return (
              <div
                key={n.id}
                className={`flex items-center border-b p-3 ${n.read_at ? "" : "bg-primary/5"}`}
              >
                <a
                  href={n.action_url ?? "/"}
                  onClick={() => {
                    void markRead(n.id);
                    setOpen(false);
                  }}
                  className="flex min-w-0 flex-1 items-start gap-2.5 text-sm"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block leading-snug">{text}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </span>
                </a>
                <button
                  onClick={() => remove(n.id)}
                  disabled={busy}
                  aria-label="Dismiss notification"
                  className="ml-2 rounded p-2 hover:bg-accent"
                >
                  <X className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
