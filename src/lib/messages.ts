import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Conversation = Tables<"conversations">;
export type Message = Tables<"messages">;

export type ConversationWithProfile = Conversation & {
  otherUser: Pick<Tables<"profiles">, "user_id" | "username" | "avatar_url">;
  lastMessage: Pick<Message, "body" | "created_at" | "sender_id"> | null;
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
      "*, user_a_profile:profiles!conversations_user_a_fkey(user_id, username, avatar_url), user_b_profile:profiles!conversations_user_b_fkey(user_id, username, avatar_url), messages(body, created_at, sender_id)",
    )
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data as unknown as (Conversation & {
    user_a_profile: ConversationWithProfile["otherUser"];
    user_b_profile: ConversationWithProfile["otherUser"];
    messages: Pick<Message, "body" | "created_at" | "sender_id">[];
  })[]).map((c) => {
    const otherUser = c.user_a === userId ? c.user_b_profile : c.user_a_profile;
    const lastMessage = c.messages.length
      ? c.messages.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0]!
      : null;
    return { ...c, otherUser, lastMessage };
  });
}

export type MessageWithSender = Message & {
  sender: Pick<Tables<"profiles">, "user_id" | "username" | "avatar_url">;
};

export async function fetchMessages(conversationId: string): Promise<MessageWithSender[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*, sender:profiles!messages_sender_id_fkey(user_id, username, avatar_url)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as unknown as MessageWithSender[];
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body });
  if (error) throw error;
}
