import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Pencil, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { ImageUploadField } from "@/components/ImageUploadField";
import {
  BUSINESS_CATEGORY_LABELS,
  fetchAllBusinesses,
  fetchOpenBusinessReports,
  postcodeDistrict,
  REPORT_REASONS,
  saveBusiness,
  setBusinessReportStatus,
  type Business,
} from "@/lib/businesses";
import { supabase } from "@/integrations/supabase/client";
import { usernameLookupCandidates } from "@/lib/usernames";

type Draft = {
  name: string;
  category: string;
  description: string;
  town: string;
  postcode: string;
  covers: string;
  website: string;
  phone: string;
  logo_url: string;
  owner: string;
  verified: boolean;
  status: string;
};

const EMPTY: Draft = {
  name: "",
  category: "mobile_mechanic",
  description: "",
  town: "",
  postcode: "",
  covers: "",
  website: "",
  phone: "",
  logo_url: "",
  owner: "",
  verified: false,
  status: "active",
};

/** Admin: add and verify local businesses, and handle reports about them. */
export function AdminBusinesses({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data: businesses } = useQuery({
    queryKey: ["admin", "businesses"],
    queryFn: fetchAllBusinesses,
  });
  const { data: reports } = useQuery({
    queryKey: ["admin", "business-reports"],
    queryFn: fetchOpenBusinessReports,
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "businesses"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "business-reports"] });
    void queryClient.invalidateQueries({ queryKey: ["businesses"] });
  }

  function edit(b: Business) {
    setEditingId(b.id);
    setDraft({
      name: b.name,
      category: b.category,
      description: b.description,
      town: b.town ?? "",
      postcode: b.postcode_district ?? "",
      covers: b.covers_areas.join(", "),
      website: b.website ?? "",
      phone: b.phone ?? "",
      logo_url: b.logo_url ?? "",
      owner: "",
      verified: b.verified,
      status: b.status,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const district = draft.postcode ? postcodeDistrict(draft.postcode) : null;
    if (draft.postcode && !district) {
      toast.error("Enter a UK postcode or district, e.g. LS6.");
      return;
    }
    const covers = draft.covers
      .split(/[,\s]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    const website = draft.website.trim()
      ? draft.website
          .trim()
          .replace(/^http:\/\//, "https://")
          .replace(/^(?!https:\/\/)/, "https://")
      : null;
    setSaving(true);
    try {
      let owner: string | null | undefined;
      if (draft.owner.trim()) {
        const { data } = await supabase
          .from("profiles")
          .select("user_id")
          .in("username", usernameLookupCandidates(draft.owner.trim()))
          .maybeSingle();
        if (!data) throw new Error("No member with that username.");
        owner = data.user_id;
      }
      await saveBusiness(
        {
          name: draft.name.trim(),
          category: draft.category,
          description: draft.description.trim(),
          town: draft.town.trim() || null,
          postcode_district: district,
          covers_areas: covers,
          website,
          phone: draft.phone.trim() || null,
          logo_url: draft.logo_url || null,
          verified: draft.verified,
          status: draft.status,
          ...(owner !== undefined ? { owner_user_id: owner } : {}),
        },
        editingId ?? undefined,
      );
      toast.success("Business saved.");
      setDraft(null);
      setEditingId(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal";
  return (
    <section className="mt-6 max-w-2xl">
      <h2 className="text-lg font-semibold">Local businesses</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Mechanics, bodywork, EV installers, detailers and dealers. Members rate them; the trust
        badge comes from reviews and upheld reports. Verified means RevMate has checked they're
        real.
      </p>

      {reports && reports.length > 0 && (
        <div className="mt-4 rounded-xl border border-destructive/30 p-4">
          <p className="text-sm font-semibold">Open reports</p>
          <ul className="mt-2 space-y-2">
            {reports.map((r) => (
              <li key={r.id} className="rounded-md bg-muted/50 p-2 text-sm">
                <p>
                  <strong>{r.businesses?.name}</strong> · {REPORT_REASONS[r.reason] ?? r.reason}
                </p>
                {r.details && <p className="text-xs text-muted-foreground">{r.details}</p>}
                <div className="mt-1 flex gap-3 text-xs">
                  <button
                    type="button"
                    className="font-semibold text-destructive"
                    onClick={async () => {
                      await setBusinessReportStatus(r.id, "upheld").catch((err: Error) =>
                        toast.error(err.message),
                      );
                      refresh();
                    }}
                  >
                    Uphold
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground"
                    onClick={async () => {
                      await setBusinessReportStatus(r.id, "dismissed").catch((err: Error) =>
                        toast.error(err.message),
                      );
                      refresh();
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!draft && (
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setDraft(EMPTY);
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="size-4" /> Add business
        </button>
      )}

      {draft && (
        <form
          onSubmit={save}
          className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Name
              <input
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
                required
                minLength={2}
                maxLength={100}
                className={`mt-1 ${input}`}
              />
            </label>
            <label className="text-sm font-medium">
              Type
              <select
                value={draft.category}
                onChange={(e) => set({ category: e.target.value })}
                className={`mt-1 ${input}`}
              >
                {Object.entries(BUSINESS_CATEGORY_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium">
            Description
            <textarea
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
              maxLength={2000}
              rows={3}
              className={`mt-1 resize-y ${input}`}
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-sm font-medium">
              Town
              <input
                value={draft.town}
                onChange={(e) => set({ town: e.target.value })}
                maxLength={60}
                className={`mt-1 ${input}`}
              />
            </label>
            <label className="text-sm font-medium">
              Postcode / district
              <input
                value={draft.postcode}
                onChange={(e) => set({ postcode: e.target.value })}
                placeholder="LS6"
                className={`mt-1 ${input}`}
              />
            </label>
            <label className="text-sm font-medium">
              Also covers
              <input
                value={draft.covers}
                onChange={(e) => set({ covers: e.target.value })}
                placeholder="LS, BD, HX"
                className={`mt-1 ${input}`}
              />
            </label>
            <label className="text-sm font-medium">
              Website
              <input
                value={draft.website}
                onChange={(e) => set({ website: e.target.value })}
                placeholder="https://…"
                className={`mt-1 ${input}`}
              />
            </label>
            <label className="text-sm font-medium">
              Phone
              <input
                value={draft.phone}
                onChange={(e) => set({ phone: e.target.value })}
                maxLength={30}
                className={`mt-1 ${input}`}
              />
            </label>
            <label className="text-sm font-medium">
              Owner's username
              <input
                value={draft.owner}
                onChange={(e) => set({ owner: e.target.value })}
                placeholder="optional"
                className={`mt-1 ${input}`}
              />
            </label>
          </div>
          <ImageUploadField
            label="Logo (optional)"
            userId={userId}
            value={draft.logo_url}
            onChange={(url) => set({ logo_url: url })}
          />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.verified}
                onChange={(e) => set({ verified: e.target.checked })}
                className="size-4 accent-primary"
              />
              Verified by RevMate
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.status === "suspended"}
                onChange={(e) => set({ status: e.target.checked ? "suspended" : "active" })}
                className="size-4 accent-primary"
              />
              Suspended (hidden, ads stop)
            </label>
          </div>
          <div className="flex gap-2">
            <button
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save business"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-md px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
        {businesses?.map((b) => (
          <li key={b.id} className="flex items-center gap-3 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 font-medium">
                {b.name}
                {b.verified && <BadgeCheck className="size-4 text-primary" />}
                {b.status === "suspended" && (
                  <span className="rounded bg-destructive/15 px-1.5 text-[11px] font-semibold text-destructive">
                    Suspended
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {BUSINESS_CATEGORY_LABELS[b.category]} {b.town ? `· ${b.town}` : ""} ·{" "}
                <Star className="inline size-3 text-amber-500" fill="currentColor" />{" "}
                {Number(b.rating_avg).toFixed(1)} ({b.reviews_count}) · {b.reports_count} reports
              </p>
            </div>
            <button
              type="button"
              aria-label={`Edit ${b.name}`}
              onClick={() => edit(b)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-4" />
            </button>
          </li>
        ))}
        {businesses?.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">No businesses yet.</li>
        )}
      </ul>
    </section>
  );
}
