import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AtSign,
  BarChart3,
  Bell,
  Crown,
  TrendingUp,
  Trophy,
  CalendarClock,
  CalendarDays,
  Car,
  CheckCircle2,
  Eye,
  Heart,
  HelpCircle,
  Megaphone,
  MessageCircle,
  Repeat2,
  Reply,
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
import { useSocialFeatures } from "@/lib/features";
import type { Tables } from "@/integrations/supabase/types";

type NotificationWithContext = Tables<"notifications"> & {
  actor: Pick<Tables<"profiles">, "username"> | null;
  community_groups: Pick<Tables<"community_groups">, "slug" | "name"> | null;
};

// Kinds that pile up ("liked your post" ×12) and read better as one line.
const BUNDLED_KINDS = new Set([
  "like",
  "comment_like",
  "car_like",
  "car_follow",
  "profile_follow",
  "repost",
  "meet_rsvp",
]);

type NotificationGroup = { key: string; items: NotificationWithContext[] };

/** Bundle same-kind notifications about the same thing into one entry. */
function groupNotifications(list: NotificationWithContext[]): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>();
  for (const n of list) {
    const key = BUNDLED_KINDS.has(n.kind)
      ? `${n.kind}:${n.post_id ?? n.garage_car_id ?? n.action_url ?? ""}:${n.read_at ? "read" : "unread"}`
      : n.id;
    const group = groups.get(key);
    if (group) group.items.push(n);
    else groups.set(key, { key, items: [n] });
  }
  return [...groups.values()];
}

function actorSummary(items: NotificationWithContext[]) {
  const names = [
    ...new Set(items.map((n) => displayUsernameWithoutAt(n.actor?.username, "A member"))),
  ];
  if (names.length <= 1) return names[0] ?? "A member";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const others = names.length - 1;
  return `${names[0]} and ${others} others`;
}

function notificationDetails(notification: NotificationWithContext, actorLabel?: string) {
  const actor = actorLabel ?? displayUsernameWithoutAt(notification.actor?.username, "A member");
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
    case "profile_follow":
      return { Icon: UserPlus, text: `${actor} started following you` };
    case "car_like":
      return { Icon: Car, text: `${actor} liked a car in your garage` };
    case "car_follow":
      return { Icon: UserPlus, text: `${actor} started following your car` };
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
    case "mention":
      return { Icon: AtSign, text: `${actor} mentioned you` };
    case "comment_reply":
      return { Icon: Reply, text: `${actor} replied to your comment` };
    case "comment_like":
      return { Icon: Heart, text: `${actor} liked your comment` };
    case "repost":
      return { Icon: Repeat2, text: `${actor} reposted your post` };
    case "spotted":
      return { Icon: Eye, text: `${actor} spotted your car` };
    case "meet_rsvp":
      return {
        Icon: CalendarDays,
        text: `${actor} ${notification.message ?? "is going to your meet"}`,
      };
    case "meet_reminder":
      return {
        Icon: CalendarClock,
        text: notification.message ?? "A meet you're going to is coming up soon",
      };
    case "car_of_week":
      return { Icon: Crown, text: notification.message ?? "Your car is Car of the Week!" };
    case "weekly_recap":
      return { Icon: BarChart3, text: notification.message ?? "Your weekly recap is ready" };
    case "rank_up":
      return { Icon: TrendingUp, text: notification.message ?? "Your car moved up the rankings" };
    case "challenge":
      return { Icon: Trophy, text: notification.message ?? "You won a challenge!" };
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
  // Meet reminders have no scheduler: whoever opens the app first nudges the
  // database to send any that are due (it only ever sends each one once).
  const social = useSocialFeatures();
  useEffect(() => {
    if (!user || !social) return;
    void supabase.rpc("send_due_meet_reminders");
  }, [user, social]);
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
  // Count bundles, not raw rows, so 12 likes on one post is one badge tick.
  const unread = groupNotifications(notifications as NotificationWithContext[]).filter(
    (group) => !group.items[0]!.read_at,
  ).length;
  async function markRead(ids?: string[]) {
    let query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user!.id)
      .is("read_at", null);
    if (ids) query = query.in("id", ids);
    const { error } = await query;
    if (error) toast.error("Could not mark notifications as read.");
    else await client.invalidateQueries({ queryKey: ["notifications"] });
  }
  async function remove(ids: string[]) {
    setBusy(true);
    const { error } = await supabase.from("notifications").delete().in("id", ids);
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
          {groupNotifications(notifications as NotificationWithContext[]).map((group) => {
            const n = group.items[0]!;
            const ids = group.items.map((item) => item.id);
            const { Icon, text } = notificationDetails(
              n,
              group.items.length > 1 ? actorSummary(group.items) : undefined,
            );
            return (
              <div
                key={group.key}
                className={`flex items-center border-b p-3 ${n.read_at ? "" : "bg-primary/5"}`}
              >
                <a
                  href={n.action_url ?? "/"}
                  onClick={() => {
                    void markRead(ids);
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
                  onClick={() => remove(ids)}
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
