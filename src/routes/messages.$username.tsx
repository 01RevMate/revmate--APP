import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isSameDay } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCheck, ImagePlus, Loader2, Send, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { fetchProfileByUsername } from "@/lib/profiles";
import {
  fetchOrCreateConversation,
  fetchMessages,
  markConversationRead,
  removeMessageImage,
  sendMessage,
  uploadMessageImage,
} from "@/lib/messages";
import { validateImageFile } from "@/lib/uploads";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { MessageImageViewer } from "@/components/MessageImageViewer";
import { displayUsernameWithoutAt } from "@/lib/usernames";

export const Route = createFileRoute("/messages/$username")({
  head: ({ params }) => {
    const handle = displayUsernameWithoutAt(params.username);
    const title = `${handle} — Messages — RevMate`;
    const description = `Message ${handle} privately on RevMate.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: MessageThreadPage,
});

function MessageThreadPage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [openImage, setOpenImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (
      !conversationId ||
      !user ||
      !messages?.some((message) => message.sender_id !== user.id && !message.read_at)
    ) {
      return;
    }
    void markConversationRead(conversationId, user.id)
      .then(() => {
        queryClient.setQueryData(
          ["messages", conversationId],
          messages.map((message) =>
            message.sender_id === user.id || message.read_at
              ? message
              : { ...message, read_at: new Date().toISOString() },
          ),
        );
        void queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
      })
      .catch(() => toast.error("Couldn't mark these messages as seen"));
  }, [conversationId, messages, queryClient, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages?.length]);

  useEffect(() => {
    const previewUrl = pendingImage?.previewUrl;
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [pendingImage?.previewUrl]);

  function chooseImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
  }

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const nextBody = body.trim();
    if ((!nextBody && !pendingImage) || !user || !conversationId) return;
    setSending(true);
    let uploadedPath: string | undefined;
    try {
      if (pendingImage) {
        uploadedPath = await uploadMessageImage(conversationId, user.id, pendingImage.file);
      }
      await sendMessage(conversationId, user.id, nextBody, uploadedPath);
      setBody("");
      setPendingImage(null);
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
    } catch (err) {
      if (uploadedPath) void removeMessageImage(uploadedPath).catch(() => undefined);
      toast.error(err instanceof Error ? err.message : "Couldn't send message");
    } finally {
      setSending(false);
    }
  }

  if (!otherProfile) {
    return <p className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  }

  const latestOwnMessageId = [...(messages ?? [])]
    .reverse()
    .find((message) => message.sender_id === user?.id)?.id;

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-2xl flex-col bg-background md:h-[calc(100dvh-4.5rem)] md:border-x md:border-border">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link
          to="/messages"
          aria-label="Back to messages"
          className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <Link
          to="/u/$username"
          params={{ username: otherProfile.username }}
          className="flex min-w-0 items-center gap-3"
        >
          <Avatar
            photoUrl={otherProfile.avatar_url}
            fallback={otherProfile.username}
            className="size-11 ring-2 ring-background outline outline-1 outline-border"
          />
          <span className="min-w-0">
            <span className="block truncate font-semibold">
              {displayUsernameWithoutAt(otherProfile.username)}
            </span>
            <span className="block text-xs text-muted-foreground">View profile</span>
          </span>
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
        {user &&
          messages?.map((message, index) => {
            const isMine = message.sender_id === user.id;
            const previous = messages[index - 1];
            const next = messages[index + 1];
            const startsDay =
              !previous || !isSameDay(new Date(previous.created_at), new Date(message.created_at));
            const startsGroup = startsDay || previous?.sender_id !== message.sender_id;
            const endsGroup =
              !next ||
              next.sender_id !== message.sender_id ||
              !isSameDay(new Date(next.created_at), new Date(message.created_at));
            const showReceipt = isMine && message.id === latestOwnMessageId;
            return (
              <div key={message.id}>
                {startsDay && (
                  <div
                    className="my-4 flex items-center gap-3"
                    aria-label={format(new Date(message.created_at), "PPPP")}
                  >
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {format(new Date(message.created_at), "d MMM yyyy")}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div
                  className={`flex gap-2 ${startsGroup ? "mt-3" : "mt-1"} ${isMine ? "justify-end" : "justify-start"}`}
                >
                  {!isMine && (
                    <div className="w-8 shrink-0 self-end">
                      {endsGroup && (
                        <Avatar
                          photoUrl={message.sender.avatar_url}
                          fallback={message.sender.username}
                          className="size-8"
                        />
                      )}
                    </div>
                  )}
                  <div
                    className={`flex max-w-[78%] flex-col ${isMine ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`overflow-hidden px-3 py-2 text-sm shadow-sm ${
                        isMine
                          ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-2xl rounded-bl-md bg-muted text-foreground"
                      }`}
                    >
                      {message.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setOpenImage(message.imageUrl)}
                          className="-mx-3 -mt-2 mb-2 block max-w-[min(70vw,320px)] overflow-hidden bg-black/5 last:mb-[-0.5rem]"
                          aria-label="Open shared photo"
                        >
                          <img
                            src={message.imageUrl}
                            alt="Shared in this conversation"
                            className="max-h-80 w-full object-cover"
                          />
                        </button>
                      )}
                      {message.body && (
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      )}
                    </div>
                    {endsGroup && (
                      <span className="mt-1 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                        {format(new Date(message.created_at), "HH:mm")}
                        {showReceipt &&
                          (message.read_at ? (
                            <>
                              <CheckCheck className="size-3.5 text-sky-500" /> Seen
                            </>
                          ) : (
                            <>
                              <Check className="size-3.5" /> Sent
                            </>
                          ))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        {user && messages?.length === 0 && (
          <div className="flex min-h-56 flex-col items-center justify-center text-center">
            <Avatar
              photoUrl={otherProfile.avatar_url}
              fallback={otherProfile.username}
              className="size-16"
            />
            <p className="mt-3 font-medium">
              Start a conversation with {displayUsernameWithoutAt(otherProfile.username)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Messages are private between you both.
            </p>
          </div>
        )}
        {!user && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sign in to see your conversation with {displayUsernameWithoutAt(otherProfile.username)}.
          </p>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={user ? handleSend : (event) => event.preventDefault()}
        onFocus={() =>
          !user &&
          openAuthModal(
            `Create a free account to message ${displayUsernameWithoutAt(otherProfile.username)}.`,
          )
        }
        className="shrink-0 border-t border-border bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:px-4"
      >
        {pendingImage && (
          <div className="relative mb-3 w-fit overflow-hidden rounded-xl border border-border bg-muted p-1">
            <img
              src={pendingImage.previewUrl}
              alt="Photo ready to send"
              className="h-24 w-24 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              aria-label="Remove photo"
              className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/70 text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={chooseImage}
          />
          <button
            type="button"
            onClick={() => (user ? fileInputRef.current?.click() : undefined)}
            disabled={sending}
            aria-label="Add a photo"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <ImagePlus className="size-5" />
          </button>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            maxLength={5000}
            placeholder={user ? "Message…" : "Sign in to write a message…"}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-muted/50 px-4 py-2.5 text-base outline-none focus:border-primary focus:bg-background"
          />
          <button
            type="submit"
            disabled={user ? sending || (!body.trim() && !pendingImage) : false}
            aria-label="Send message"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-40"
          >
            {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          </button>
        </div>
      </form>

      {openImage && <MessageImageViewer imageUrl={openImage} onClose={() => setOpenImage(null)} />}
    </div>
  );
}
