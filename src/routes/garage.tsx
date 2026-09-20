import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/garage")({
  // "My Garage" always resolves to the logged-in user's own public
  // profile page — there's no separate private garage view, so this is
  // just a stable link target that doesn't require knowing your own
  // username ahead of time.
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) throw redirect({ to: "/" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (!profile) throw redirect({ to: "/" });

    throw redirect({ to: "/u/$username", params: { username: profile.username } });
  },
});
