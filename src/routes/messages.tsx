import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchConversations } from "@/lib/messages";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/messages")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [{ title: "Messages — RevMate" }],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user } = useAuth();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: () => fetchConversations(user!.id),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && conversations?.length === 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
          <MessageCircle className="size-5 shrink-0" />
          No conversations yet — message someone from their profile.
        </div>
      )}

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
                <p className="text-sm font-medium">{c.otherUser.username}</p>
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
    </div>
  );
}
