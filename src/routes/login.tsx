import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — RevMate" },
      { name: "description", content: "Log in to your RevMate account." },
      { property: "og:title", content: "Log in — RevMate" },
      { property: "og:description", content: "Log in to your RevMate account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/garage" });
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <Link to="/" aria-label="RevMate home" className="mx-auto block w-fit">
        <BrandLogo className="h-24 w-48" />
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Log in</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="flex items-center justify-between gap-3 text-sm font-medium">
            Password
            <Link to="/forgot-password" className="font-normal text-muted-foreground underline underline-offset-4">
              Forgot password?
            </Link>
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <Button
          type="submit"
          disabled={saving}
          className="w-full"
        >
          {saving ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        No account?{" "}
        <Link to="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
