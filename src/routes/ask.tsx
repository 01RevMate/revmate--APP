import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { CarPicker } from "@/components/CarPicker";

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [
      { title: "Ask a question — RevMate" },
      {
        name: "description",
        content: "Post a question to the owners and enthusiasts of a specific car generation.",
      },
      { property: "og:title", content: "Ask a question — RevMate" },
      {
        property: "og:description",
        content: "Post a question to the owners and enthusiasts of a specific car generation.",
      },
    ],
  }),
  component: AskPage,
});

function AskPage() {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  const [carId, setCarId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      openAuthModal("Create a free account to ask a question.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("questions")
      .insert({ car_id: carId, user_id: user.id, title, body });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Question posted");
    navigate({ to: "/garage" });
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Ask a question</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Car">
          <CarPicker value={carId} onChange={setCarId} />
        </Field>
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => !user && openAuthModal("Create a free account to ask a question.")}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Details">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => !user && openAuthModal("Create a free account to ask a question.")}
            rows={6}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Posting…" : "Post question"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
