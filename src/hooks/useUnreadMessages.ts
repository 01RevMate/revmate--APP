import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchUnreadMessageCount } from "@/lib/messages";

export const unreadMessagesKey = (userId: string | undefined) => ["unread-messages", userId];

/** How many messages sent to me I haven't opened yet (0 when signed out). */
export function useUnreadMessages(): number {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: unreadMessagesKey(user?.id),
    queryFn: () => fetchUnreadMessageCount(user!.id),
    enabled: !!user,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  return user ? (data ?? 0) : 0;
}

/**
 * Keeps the unread count live. Mounted once (in the always-present bottom
 * nav) so there's a single realtime channel for the whole app.
 */
export function useUnreadMessagesSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`unread-messages:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () =>
        queryClient.invalidateQueries({ queryKey: unreadMessagesKey(user.id) }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user]);
}
