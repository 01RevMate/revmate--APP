import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchConversations } from "@/lib/messages";
import { Avatar } from "@/components/Avatar";
import { displayUsernameWithoutAt } from "@/lib/usernames";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — RevMate" },
      { name: "description", content: "Read and reply to private RevMate conversations with other members." },
      { property: "og:title", content: "Messages — RevMate" },
      { property: "og:description", content: "Read and reply to private RevMate conversations with other members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user, loading } = useAuth();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: () => fetchConversations(user!.id),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>

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
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
          {conversations?.map((c) => (
            <li key={c.id}>
              <Link
                to="/messages/$username"
                params={{ username: c.otherUser.username }}
                className="flex items-center gap-3 p-4 hover:bg-accent"
              >
                <Avatar photoUrl={c.otherUser.avatar_url} fallback={c.otherUser.username} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{displayUsernameWithoutAt(c.otherUser.username)}</p>
                  {c.lastMessage && (
                    <p className="truncate text-xs text-muted-foreground">
                      {c.lastMessage.sender_id === user?.id ? "You: " : ""}
                      {c.lastMessage.body}
                    </p>
                  )}
                </div>
                {c.lastMessage && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(c.lastMessage.created_at), { addSuffix: true })}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
