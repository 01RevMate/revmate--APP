import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useProfile, PERSONA_LABELS } from "@/hooks/useProfile";
import { addGarageCar, fetchGarage } from "@/lib/garage";
import { supabase } from "@/integrations/supabase/client";
import { GarageCarCard } from "@/components/GarageCarCard";
import type { Profile } from "@/hooks/useProfile";

export const Route = createFileRoute("/garage")({
  head: () => ({
    meta: [
      { title: "My Garage — RevMate" },
      { name: "description", content: "The cars you own and the mods you've done to them." },
    ],
  }),
  component: GaragePage,
});

function GaragePage() {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [generation, setGeneration] = useState("");
  const [year, setYear] = useState("");
  const [nickname, setNickname] = useState("");
  const [spec, setSpec] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: garage, isLoading } = useQuery({
    queryKey: ["garage", user?.id],
    enabled: !!user,
    queryFn: () => fetchGarage(user!.id),
  });

  function refreshGarage() {
    queryClient.invalidateQueries({ queryKey: ["garage", user?.id] });
  }

  async function handleAddCar(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      openAuthModal("Create a free account to set up your garage.");
      return;
    }
    if (!make.trim() || !model.trim()) return;
    setSaving(true);
    try {
      await addGarageCar({
        userId: user.id,
        make: make.trim(),
        model: model.trim(),
        generation: generation.trim() || undefined,
        year: year ? Number(year) : undefined,
        nickname: nickname.trim() || undefined,
        spec: spec.trim() || undefined,
      });
      setMake("");
      setModel("");
      setGeneration("");
      setYear("");
      setNickname("");
      setSpec("");
      setAdding(false);
      setAdvanced(false);
      refreshGarage();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add car");
    } finally {
      setSaving(false);
    }
  }

  async function handlePersonaChange(persona: Profile["persona"]) {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ persona }).eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">My Garage</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          <button onClick={() => openAuthModal("Create a free account to set up your garage.")} className="underline">
            Create a free account
          </button>{" "}
          to add your cars and track your mods.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">My Garage</h1>

      {profile && (
        <label className="mt-4 block max-w-xs space-y-1.5">
          <span className="text-sm font-medium">I'm a…</span>
          <select
            value={profile.persona}
            onChange={(e) => handlePersonaChange(e.target.value as Profile["persona"])}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {Object.entries(PERSONA_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="mt-6 space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading garage…</p>}

        {!isLoading && garage?.length === 0 && !adding && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No cars in your garage yet.
          </div>
        )}

        {garage?.map((car) => (
          <GarageCarCard key={car.id} car={car} isOwner />
        ))}

        {adding ? (
          <form onSubmit={handleAddCar} className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Make">
                <input
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  required
                  placeholder="e.g. Volkswagen"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Model">
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                  placeholder="e.g. Golf GTI"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
            </div>

            {advanced && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Generation">
                  <input
                    value={generation}
                    onChange={(e) => setGeneration(e.target.value)}
                    placeholder="e.g. Mk7"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Year">
                  <input
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    type="number"
                    placeholder="e.g. 2018"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Nickname">
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. Daily"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Spec / trim">
                  <input
                    value={spec}
                    onChange={(e) => setSpec(e.target.value)}
                    placeholder="e.g. Performance Pack, DSG"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </Field>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAdvanced((v) => !v)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {advanced ? "Hide advanced details" : "+ Advanced details"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Adding…" : "Add car"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Add a car
          </button>
        )}
      </div>
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
