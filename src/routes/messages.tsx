import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchConversations } from "@/lib/messages";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { displayUsernameWithoutAt } from "@/lib/usernames";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — RevMate" },
      {
        name: "description",
        content: "Read and reply to private RevMate conversations with other members.",
      },
      { property: "og:title", content: "Messages — RevMate" },
      {
        property: "og:description",
        content: "Read and reply to private RevMate conversations with other members.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesRoute,
});

function MessagesRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/messages" || pathname === "/messages/" ? <MessagesPage /> : <Outlet />;
}

function MessagesPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: () => fetchConversations(user!.id),
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`conversation-list:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () =>
        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Private conversations with other members.
        </p>
      </div>

      {!loading && !user && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <MessageCircle className="size-6 shrink-0" />
          <p>Sign in to see your conversations and message other members.</p>
          <div className="flex gap-2">
            <Link
              to="/signup"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sign up
            </Link>
            <Link
              to="/login"
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Log in
            </Link>
          </div>
        </div>
      )}

      {user && isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      {user && !isLoading && conversations?.length === 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          <MessageCircle className="size-5 shrink-0" />
          No conversations yet — message someone from their profile.
        </div>
      )}

      {user && (
        <ul className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {conversations?.map((c) => (
            <li key={c.id} className="border-b border-border last:border-b-0">
              <Link
                to="/messages/$username"
                params={{ username: c.otherUser.username }}
                className={`flex items-center gap-3 p-4 transition-colors hover:bg-accent ${c.unreadCount > 0 ? "bg-primary/[0.04]" : ""}`}
              >
                <div className="relative">
                  <Avatar
                    photoUrl={c.otherUser.avatar_url}
                    fallback={c.otherUser.username}
                    className="size-12"
                  />
                  {c.unreadCount > 0 && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${c.unreadCount > 0 ? "font-bold" : "font-medium"}`}>
                    {displayUsernameWithoutAt(c.otherUser.username)}
                  </p>
                  {c.lastMessage && (
                    <p
                      className={`truncate text-sm ${c.unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    >
                      {c.lastMessage.sender_id === user?.id ? "You: " : ""}
                      {c.lastMessage.body || (c.lastMessage.image_path ? "Photo" : "Message")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {c.lastMessage && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.lastMessage.created_at), { addSuffix: true })}
                    </span>
                  )}
                  {c.unreadCount > 0 && (
                    <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {c.unreadCount > 99 ? "99+" : c.unreadCount}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
