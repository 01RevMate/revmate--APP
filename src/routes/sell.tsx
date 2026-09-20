import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CarPicker } from "@/components/CarPicker";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Sell a car or part — RevMate" },
      {
        name: "description",
        content: "Create a listing for a car or a part against the exact model and generation.",
      },
      { property: "og:title", content: "Sell a car or part — RevMate" },
      {
        property: "og:description",
        content: "Create a listing for a car or a part against the exact model and generation.",
      },
    ],
  }),
  component: SellPage,
});

function SellPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [carId, setCarId] = useState("");
  const [type, setType] = useState<"car" | "part">("car");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("listings").insert({
      car_id: carId,
      user_id: user.id,
      title,
      description,
      price: price ? Number(price) : null,
      type,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Listing created");
    navigate({ to: "/profile" });
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Create a listing</h1>
      {!loading && !user ? (
        <p className="mt-4 text-sm text-muted-foreground">
          <Link to="/login" className="underline">
            Log in
          </Link>{" "}
          to create a listing.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Car">
            <CarPicker value={carId} onChange={setCarId} />
          </Field>
          <Field label="Listing type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "car" | "part")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="car">Whole car</option>
              <option value="part">Part</option>
            </select>
          </Field>
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Price (£)">
            <input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Publishing…" : "Publish listing"}
          </button>
        </form>
      )}
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
