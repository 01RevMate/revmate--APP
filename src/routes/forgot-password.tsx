import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — RevMate" },
      { name: "description", content: "Request a secure link to reset your RevMate password." },
      { property: "og:title", content: "Forgot password — RevMate" },
      { property: "og:description", content: "Request a secure link to reset your RevMate password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <Link to="/" aria-label="RevMate home" className="mx-auto block w-fit">
        <BrandLogo className="h-24 w-48" />
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Reset your password</h1>
      {sent ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            If an account exists for {email}, you’ll receive a password reset link shortly.
          </p>
          <Link to="/login" className="text-sm font-medium underline underline-offset-4">
            Back to log in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <Button type="submit" disabled={sending} className="w-full">
            {sending ? "Sending…" : "Send reset link"}
          </Button>
          <Link to="/login" className="block text-center text-sm text-muted-foreground underline underline-offset-4">
            Back to log in
          </Link>
        </form>
      )}
    </main>
  );
}