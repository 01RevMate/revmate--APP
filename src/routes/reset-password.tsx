import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — RevMate" },
      { name: "description", content: "Choose a new password for your RevMate account." },
      { property: "og:title", content: "Choose a new password — RevMate" },
      { property: "og:description", content: "Choose a new password for your RevMate account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const hashType = new URLSearchParams(window.location.hash.slice(1)).get("type");
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setReady(hashType === "recovery" || Boolean(data.session));
      setChecking(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setChecking(false);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/login", replace: true });
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <Link to="/" aria-label="RevMate home" className="mx-auto block w-fit">
        <BrandLogo className="h-24 w-48" />
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Choose a new password</h1>
      {checking ? (
        <p className="mt-4 text-sm text-muted-foreground">Checking your reset link…</p>
      ) : !ready ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">This reset link is invalid or has expired.</p>
          <Link to="/forgot-password" className="text-sm font-medium underline underline-offset-4">
            Request another link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </main>
  );
}