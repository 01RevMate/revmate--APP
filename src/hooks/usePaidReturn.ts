import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Stripe sends people back with ?paid=1. Thank them, refresh what they paid
 * for (the webhook may take a few seconds) and tidy the address bar.
 */
export function usePaidReturn(message: string, queryKeys: unknown[][]) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("paid") !== "1") return;
    toast.success(message);
    url.searchParams.delete("paid");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    const refresh = () => {
      for (const key of [...queryKeys, ["my-billing"], ["plus-member"]]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    };
    refresh();
    const timers = [3000, 8000].map((ms) => window.setTimeout(refresh, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // Runs once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
