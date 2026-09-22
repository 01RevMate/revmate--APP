import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/garage")({
  // "My Garage" always resolves to the logged-in user's own public profile
  // page — there's no separate private garage view, so this is just a
  // stable link target that doesn't require knowing your own username ahead
  // of time. Logged out, there's no "my" anything to resolve to, so this
  // renders a sign-in prompt instead of silently bouncing to the homepage.
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (!profile) return;

    throw redirect({ to: "/u/$username", params: { username: profile.username } });
  },
  head: () => ({
    meta: [
      { title: "My Garage — RevMate" },
      { name: "description", content: "Open your RevMate garage to manage the cars linked to your profile." },
      { property: "og:title", content: "My Garage — RevMate" },
      { property: "og:description", content: "Open your RevMate garage to manage the cars linked to your profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GaragePromptPage,
});

function GaragePromptPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">My Garage</h1>
      <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        <Warehouse className="size-6 shrink-0" />
        <p>Sign in to add your cars and see your own garage.</p>
        <div className="flex gap-2">
          <Link
            to="/signup"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign up
          </Link>
          <Link to="/login" className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
