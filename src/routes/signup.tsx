import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { normalizeUsername } from "@/lib/usernames";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — RevMate" },
      { name: "description", content: "Create a RevMate account to ask, answer and trade." },
      { property: "og:title", content: "Sign up — RevMate" },
      { property: "og:description", content: "Create a RevMate account to ask, answer and trade." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { username: normalizeUsername(username) },
      },
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      navigate({ to: "/garage" });
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-sm px-4 py-10">
        <Link to="/" aria-label="RevMate home" className="mx-auto block w-fit">
          <BrandLogo className="h-24 w-48" />
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We've sent a confirmation link to {email}. Click it to finish creating your account.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <Link to="/" aria-label="RevMate home" className="mx-auto block w-fit">
        <BrandLogo className="h-24 w-48" />
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign up</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Username</span>
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
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
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
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
          {saving ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
