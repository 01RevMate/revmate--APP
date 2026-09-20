import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchProfileByUsername } from "@/lib/profiles";
import { fetchOrCreateConversation, fetchMessages, sendMessage } from "@/lib/messages";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/messages/$username")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) throw redirect({ to: "/" });
  },
  head: ({ params }) => ({
    meta: [{ title: `${params.username} — Messages — RevMate` }],
  }),
  component: MessageThreadPage,
});

function MessageThreadPage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const { data: otherProfile } = useQuery({
    queryKey: ["profile-by-username", username],
    queryFn: () => fetchProfileByUsername(username),
  });

  const { data: conversationId } = useQuery({
    queryKey: ["conversation-id", user?.id, otherProfile?.user_id],
    enabled: !!user && !!otherProfile,
    queryFn: () => fetchOrCreateConversation(user!.id, otherProfile!.user_id),
  });

  const { data: messages, refetch } = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: () => fetchMessages(conversationId!),
    refetchInterval: 5000,
  });

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !user || !conversationId) return;
    setSending(true);
    try {
      await sendMessage(conversationId, user.id, body.trim());
      setBody("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send message");
    } finally {
      setSending(false);
    }
  }

  if (!otherProfile) {
    return <p className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-1px)] max-w-2xl flex-col px-4 py-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Link to="/messages" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <Link to="/u/$username" params={{ username: otherProfile.username }} className="flex items-center gap-2">
          <Avatar photoUrl={otherProfile.avatar_url} fallback={otherProfile.username} className="size-8" />
          <span className="font-medium">{otherProfile.username}</span>
        </Link>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages?.map((m) => {
          const isMine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  isMine ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}
        {messages?.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Say hello to {otherProfile.username}.
          </p>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-border pt-4">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
