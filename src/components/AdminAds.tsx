import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Eye, MousePointerClick, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdCard } from "@/components/AdCard";
import { ImageUploadField } from "@/components/ImageUploadField";
import {
  deleteCampaign,
  fetchAllBusinesses,
  fetchCampaigns,
  saveCampaign,
  setCampaignActive,
  type AdCampaign,
  type AdCampaignDraft,
} from "@/lib/businesses";

const toLocalInput = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "";

function blank(): AdCampaignDraft {
  return {
    name: "",
    business_id: null,
    headline: "",
    body: "",
    image_url: null,
    cta_label: "Find out more",
    cta_url: "",
    placement: "feed",
    target_areas: [],
    target_fuel: null,
    target_segment: null,
    starts_at: new Date().toISOString(),
    ends_at: null,
    active: true,
  };
}

/**
 * Admin ads manager: sponsored cards in the feed for local businesses and
 * partners, targeted by area and car type, with a live preview and stats.
 */
export function AdminAds({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data: campaigns } = useQuery({ queryKey: ["admin", "ads"], queryFn: fetchCampaigns });
  const { data: businesses } = useQuery({
    queryKey: ["admin", "businesses"],
    queryFn: fetchAllBusinesses,
  });
  const [draft, setDraft] = useState<AdCampaignDraft | null>(null);
  const [areasText, setAreasText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<AdCampaignDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const business = businesses?.find((b) => b.id === draft?.business_id);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "ads"] });
    void queryClient.invalidateQueries({ queryKey: ["ads"] });
  }

  function start(next: AdCampaignDraft, id: string | null = null) {
    setDraft(next);
    setEditingId(id);
    setAreasText((next.target_areas ?? []).join(", "));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const cta = draft.cta_url.trim();
    if (!/^(\/(?!\/)|https:\/\/)/.test(cta)) {
      toast.error("The link must start with https:// or /");
      return;
    }
    setSaving(true);
    try {
      await saveCampaign(
        {
          ...draft,
          cta_url: cta,
          target_areas: areasText
            .split(/[,\s]+/)
            .map((a) => a.trim().toUpperCase())
            .filter(Boolean),
        },
        editingId ?? undefined,
      );
      toast.success("Campaign saved.");
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
  const live = (c: AdCampaign) =>
    c.active &&
    new Date(c.starts_at).getTime() <= Date.now() &&
    (!c.ends_at || new Date(c.ends_at).getTime() > Date.now());

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">Ads manager</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Sponsored cards in the feed for local businesses and partners. Target an area (postcode
        districts like LS6, or wider areas like LS) and car type. Members set their area in
        Settings. Ads are always labelled "Sponsored" and show the business's member rating.
      </p>

      {!draft && (
        <button
          type="button"
          onClick={() => start(blank())}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="size-4" /> New campaign
        </button>
      )}

      {draft && (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <form onSubmit={save} className="space-y-3 rounded-xl border border-border bg-card p-4">
            <label className="block text-sm font-medium">
              Campaign name (only admins see this)
              <input
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
                required
                minLength={2}
                maxLength={100}
                className={`mt-1 ${input}`}
              />
            </label>
            <label className="block text-sm font-medium">
              Business (optional)
              <select
                value={draft.business_id ?? ""}
                onChange={(e) => set({ business_id: e.target.value || null })}
                className={`mt-1 ${input}`}
              >
                <option value="">None — RevMate or a partner</option>
                {businesses?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Headline
              <input
                value={draft.headline}
                onChange={(e) => set({ headline: e.target.value })}
                required
                minLength={2}
                maxLength={90}
                className={`mt-1 ${input}`}
              />
            </label>
            <label className="block text-sm font-medium">
              Text
              <textarea
                value={draft.body ?? ""}
                onChange={(e) => set({ body: e.target.value })}
                maxLength={300}
                rows={2}
                className={`mt-1 resize-none ${input}`}
              />
            </label>
            <ImageUploadField
              label="Image (optional)"
              userId={userId}
              value={draft.image_url ?? ""}
              onChange={(url) => set({ image_url: url || null })}
              shape="wide"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Button text
                <input
                  value={draft.cta_label ?? ""}
                  onChange={(e) => set({ cta_label: e.target.value })}
                  required
                  maxLength={30}
                  className={`mt-1 ${input}`}
                />
              </label>
              <label className="text-sm font-medium">
                Button link
                <input
                  value={draft.cta_url}
                  onChange={(e) => set({ cta_url: e.target.value })}
                  required
                  placeholder="https://… or /businesses/…"
                  className={`mt-1 ${input}`}
                />
              </label>
            </div>
            <label className="block text-sm font-medium">
              Areas (blank = all of the UK)
              <input
                value={areasText}
                onChange={(e) => setAreasText(e.target.value)}
                placeholder="LS6, LS7, BD"
                className={`mt-1 ${input}`}
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Car fuel
                <select
                  value={draft.target_fuel ?? ""}
                  onChange={(e) => set({ target_fuel: e.target.value || null })}
                  className={`mt-1 ${input}`}
                >
                  <option value="">Any</option>
                  <option value="electric">Electric drivers</option>
                  <option value="hybrid">Hybrid drivers</option>
                  <option value="petrol">Petrol drivers</option>
                  <option value="diesel">Diesel drivers</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Brand tier
                <select
                  value={draft.target_segment ?? ""}
                  onChange={(e) => set({ target_segment: e.target.value || null })}
                  className={`mt-1 ${input}`}
                >
                  <option value="">Any</option>
                  <option value="supercar">Supercar</option>
                  <option value="luxury">Luxury</option>
                  <option value="premium">Premium</option>
                  <option value="performance">Performance</option>
                  <option value="mainstream">Mainstream</option>
                  <option value="value">Value</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Starts
                <input
                  type="datetime-local"
                  value={toLocalInput(draft.starts_at)}
                  onChange={(e) =>
                    set({
                      starts_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : new Date().toISOString(),
                    })
                  }
                  className={`mt-1 ${input}`}
                />
              </label>
              <label className="text-sm font-medium">
                Ends (optional)
                <input
                  type="datetime-local"
                  value={toLocalInput(draft.ends_at)}
                  onChange={(e) =>
                    set({ ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })
                  }
                  className={`mt-1 ${input}`}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.active ?? true}
                onChange={(e) => set({ active: e.target.checked })}
                className="size-4 accent-primary"
              />
              Switched on
            </label>
            <div className="flex gap-2">
              <button
                disabled={saving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Launch campaign"}
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
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Preview — how it looks in the feed
            </p>
            <div className="mx-auto max-w-md">
              <AdCard
                preview
                ad={{
                  id: "preview",
                  headline: draft.headline,
                  body: draft.body ?? "",
                  image_url: draft.image_url ?? null,
                  cta_label: draft.cta_label ?? "Find out more",
                  cta_url: draft.cta_url || "/",
                  business_id: business?.id ?? null,
                  business_name: business?.name ?? null,
                  business_rating: business ? Number(business.rating_avg) : null,
                  business_reviews: business?.reviews_count ?? null,
                  business_verified: business?.verified ?? null,
                }}
              />
            </div>
          </div>
        </div>
      )}

      <ul className="mt-6 max-w-2xl divide-y divide-border rounded-lg border border-border">
        {campaigns?.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${live(c) ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}
                >
                  {live(c) ? "Live" : c.active ? "Scheduled/ended" : "Off"}
                </span>
                {c.name}
              </p>
              <p className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{c.target_areas.length ? c.target_areas.join(", ") : "All UK"}</span>
                <span className="flex items-center gap-1">
                  <Eye className="size-3.5" /> {c.impressions}
                </span>
                <span className="flex items-center gap-1">
                  <MousePointerClick className="size-3.5" /> {c.clicks}
                  {c.impressions > 0 && ` (${((c.clicks / c.impressions) * 100).toFixed(1)}%)`}
                </span>
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={c.active}
                onChange={async (e) => {
                  await setCampaignActive(c.id, e.target.checked).catch((err: Error) =>
                    toast.error(err.message),
                  );
                  refresh();
                }}
              />
              On
            </label>
            <button
              type="button"
              aria-label="Edit campaign"
              onClick={() =>
                start(
                  {
                    name: c.name,
                    business_id: c.business_id,
                    headline: c.headline,
                    body: c.body,
                    image_url: c.image_url,
                    cta_label: c.cta_label,
                    cta_url: c.cta_url,
                    placement: c.placement,
                    target_areas: c.target_areas,
                    target_fuel: c.target_fuel,
                    target_segment: c.target_segment,
                    starts_at: c.starts_at,
                    ends_at: c.ends_at,
                    active: c.active,
                  },
                  c.id,
                )
              }
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Delete campaign"
              onClick={async () => {
                if (!window.confirm(`Delete "${c.name}"?`)) return;
                await deleteCampaign(c.id).catch((err: Error) => toast.error(err.message));
                refresh();
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {campaigns?.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">No campaigns yet.</li>
        )}
      </ul>
    </section>
  );
}
