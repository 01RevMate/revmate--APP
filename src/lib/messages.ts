import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { validateImageFile } from "@/lib/uploads";

export type Conversation = Tables<"conversations">;
export type Message = Tables<"messages">;

export type ConversationWithProfile = Conversation & {
  otherUser: Pick<Tables<"profiles">, "user_id" | "username" | "avatar_url">;
  lastMessage:
    | (Pick<Message, "body" | "created_at" | "sender_id" | "read_at"> & {
        image_path: string | null;
      })
    | null;
  unreadCount: number;
};

// user_a/user_b must always be stored sorted so a pair can't create two rows.
function sortedPair(userIdA: string, userIdB: string): [string, string] {
  return userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
}

export async function fetchOrCreateConversation(myId: string, otherId: string): Promise<string> {
  const [userA, userB] = sortedPair(myId, otherId);
  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", userA)
    .eq("user_b", userB)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({ user_a: userA, user_b: userB })
    .select("id")
    .single();
  if (createError) throw createError;
  return created.id;
}

export async function fetchConversations(userId: string): Promise<ConversationWithProfile[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "*, user_a_profile:profiles!conversations_user_a_fkey(user_id, username, avatar_url), user_b_profile:profiles!conversations_user_b_fkey(user_id, username, avatar_url), messages(body, created_at, sender_id, read_at, image_path)",
    )
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (
    data as unknown as (Conversation & {
      user_a_profile: ConversationWithProfile["otherUser"];
      user_b_profile: ConversationWithProfile["otherUser"];
      messages: (Pick<Message, "body" | "created_at" | "sender_id" | "read_at"> & {
        image_path: string | null;
      })[];
    })[]
  )
    .map((c) => {
      const otherUser = c.user_a === userId ? c.user_b_profile : c.user_a_profile;
      const lastMessage = c.messages.length
        ? c.messages.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0]!
        : null;
      const unreadCount = c.messages.filter(
        (message) => message.sender_id !== userId && !message.read_at,
      ).length;
      return { ...c, otherUser, lastMessage, unreadCount };
    })
    .sort((a, b) =>
      (b.lastMessage?.created_at ?? b.created_at).localeCompare(
        a.lastMessage?.created_at ?? a.created_at,
      ),
    );
}

export type MessageWithSender = Message & {
  image_path: string | null;
  imageUrl: string | null;
  sender: Pick<Tables<"profiles">, "user_id" | "username" | "avatar_url">;
};

export async function fetchMessages(conversationId: string): Promise<MessageWithSender[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*, sender:profiles!messages_sender_id_fkey(user_id, username, avatar_url)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data as unknown as Omit<MessageWithSender, "imageUrl">[];
  const imagePaths = rows.flatMap((message) => (message.image_path ? [message.image_path] : []));
  const signedUrls = new Map<string, string>();
  if (imagePaths.length > 0) {
    const { data: signed, error: signedError } = await supabase.storage
      .from("message-images")
      .createSignedUrls(imagePaths, 3600);
    if (signedError) throw signedError;
    signed?.forEach((item) => {
      if (item.path && item.signedUrl) signedUrls.set(item.path, item.signedUrl);
    });
  }
  return rows.map((message) => ({
    ...message,
    imageUrl: message.image_path ? (signedUrls.get(message.image_path) ?? null) : null,
  }));
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  imagePath?: string,
) {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body,
    image_path: imagePath ?? null,
  });
  if (error) throw error;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

export async function uploadMessageImage(
  conversationId: string,
  userId: string,
  file: File,
): Promise<string> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${conversationId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("message-images")
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export async function removeMessageImage(path: string) {
  const { error } = await supabase.storage.from("message-images").remove([path]);
  if (error) throw error;
}
