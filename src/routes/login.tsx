import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { safeRedirect } from "@/lib/authRedirect";
import { useState } from "react";
import { Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  // ?redirect=/battles sends people back to what they were trying to open.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = safeRedirect(search["redirect"]);
    return redirect ? { redirect } : {};
  },
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Log in — RevMate" },
      { name: "description", content: "Log in to your RevMate account." },
      { property: "og:title", content: "Log in — RevMate" },
      { property: "og:description", content: "Log in to your RevMate account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect } = Route.useSearch();
  function goOn() {
    if (redirect) router.history.push(redirect);
    else navigate({ to: "/garage" });
  }
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
    goOn();
  }

  const fieldClass =
    "flex items-center gap-3 rounded-full bg-background px-4 py-3 shadow-[var(--neu-field)] transition-shadow focus-within:ring-2 focus-within:ring-ring";
  const inputClass =
    "w-full min-w-0 bg-transparent! p-0 text-base shadow-none! outline-none placeholder:text-muted-foreground";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-sm items-center px-4 py-10">
      <div className="w-full rounded-3xl bg-card p-6 shadow-[var(--neu-card)] sm:p-8">
        <Link to="/" aria-label="RevMate home" className="mx-auto block w-fit">
          <BrandLogo className="h-20 w-40" />
        </Link>
        <h1 className="mt-4 text-center text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Log in to your RevMate account.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className={fieldClass}>
            <Mail className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={fieldClass}>
            <Lock className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <Button type="submit" disabled={saving} className="h-11 w-full rounded-full text-base">
            {saving ? "Logging in…" : "Log in"}
          </Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          New to RevMate?
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button asChild variant="secondary" className="h-11 w-full rounded-full text-base">
          <Link to="/signup" search={redirect ? { redirect } : {}}>
            Create an account
          </Link>
        </Button>
      </div>
    </div>
  );
}
