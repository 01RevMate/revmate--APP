import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Eye, MousePointerClick, Pencil, Sparkles, SquarePen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { ImageUploadField } from "@/components/ImageUploadField";
import {
  AUDIENCE_LABELS,
  blankTemplate,
  deleteAnnouncement,
  fetchAllAnnouncements,
  fetchAnnouncementStats,
  saveAnnouncement,
  setAnnouncementActive,
  updateTemplate,
  type Announcement,
  type AnnouncementDraft,
} from "@/lib/announcements";
import { LATEST_RELEASE } from "@/lib/changelog";

// <input type="datetime-local"> works in local time without a zone.
const toLocalInput = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "";
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

function status(a: Announcement): { label: string; tone: string } {
  const now = Date.now();
  if (!a.active) return { label: "Off", tone: "bg-muted text-muted-foreground" };
  if (new Date(a.starts_at).getTime() > now)
    return { label: "Scheduled", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
  if (a.ends_at && new Date(a.ends_at).getTime() <= now)
    return { label: "Ended", tone: "bg-muted text-muted-foreground" };
  return { label: "Live", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" };
}

/**
 * Admin: pop-up messages shown to signed-in members when they open the app.
 * Start from the latest app update or write your own; each member sees each
 * announcement once.
 */
export function AdminAnnouncements({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data: announcements } = useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: fetchAllAnnouncements,
  });
  const { data: stats } = useQuery({
    queryKey: ["admin", "announcement-stats"],
    queryFn: fetchAnnouncementStats,
  });
  const [draft, setDraft] = useState<AnnouncementDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "announcement-stats"] });
    void queryClient.invalidateQueries({ queryKey: ["announcement"] });
  }

  function start(next: AnnouncementDraft, id: string | null = null) {
    setDraft(next);
    setEditingId(id);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!!draft.cta_label?.trim() !== !!draft.cta_url?.trim()) {
      toast.error("Add both a button label and a link, or leave both empty.");
      return;
    }
    setSaving(true);
    try {
      await saveAnnouncement(draft, editingId ?? undefined);
      toast.success(editingId ? "Announcement updated." : "Announcement saved.");
      setDraft(null);
      setEditingId(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the announcement.");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const set = (patch: Partial<AnnouncementDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <section className="mt-6 max-w-2xl">
      <h2 className="text-lg font-semibold">Pop-up announcements</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A message that pops up for signed-in members when they open the app. Each person sees each
        announcement once.
      </p>

      {!draft && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => start(updateTemplate())}
            className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-4 text-left hover:border-primary"
          >
            <Sparkles className="size-5 text-primary" />
            <span className="font-semibold">Latest update</span>
            <span className="text-xs text-muted-foreground">
              Prefilled with version {LATEST_RELEASE.version}: {LATEST_RELEASE.title}
            </span>
          </button>
          <button
            type="button"
            onClick={() => start(blankTemplate())}
            className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-4 text-left hover:border-primary"
          >
            <SquarePen className="size-5 text-primary" />
            <span className="font-semibold">Custom message</span>
            <span className="text-xs text-muted-foreground">
              Events, offers, maintenance notices, anything else
            </span>
          </button>
        </div>
      )}

      {draft && (
        <form
          onSubmit={handleSave}
          className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <label className="block text-sm font-medium">
            Title
            <input
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              required
              minLength={2}
              maxLength={120}
              className={`mt-1 font-normal ${input}`}
            />
          </label>
          <label className="block text-sm font-medium">
            Message
            <textarea
              value={draft.body}
              onChange={(e) => set({ body: e.target.value })}
              required
              minLength={2}
              maxLength={2000}
              rows={6}
              className={`mt-1 resize-y font-normal ${input}`}
            />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              New lines are kept. Start lines with • for bullet points. {draft.body.length}/2000
            </span>
          </label>
          <ImageUploadField
            label="Image (optional)"
            userId={userId}
            value={draft.image_url ?? ""}
            onChange={(url) => set({ image_url: url || null })}
            shape="wide"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Button label (optional)
              <input
                value={draft.cta_label ?? ""}
                onChange={(e) => set({ cta_label: e.target.value || null })}
                maxLength={40}
                placeholder="e.g. Try it now"
                className={`mt-1 font-normal ${input}`}
              />
            </label>
            <label className="block text-sm font-medium">
              Button link
              <input
                value={draft.cta_url ?? ""}
                onChange={(e) => set({ cta_url: e.target.value || null })}
                pattern="^(/(?!/).*|https://.+)$"
                placeholder="/marketplace or https://…"
                className={`mt-1 font-normal ${input}`}
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block text-sm font-medium">
              Who sees it
              <select
                value={draft.audience ?? "everyone"}
                onChange={(e) => set({ audience: e.target.value })}
                className={`mt-1 font-normal ${input}`}
              >
                {Object.entries(AUDIENCE_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Starts
              <input
                type="datetime-local"
                value={toLocalInput(draft.starts_at)}
                onChange={(e) =>
                  set({ starts_at: fromLocalInput(e.target.value) ?? new Date().toISOString() })
                }
                className={`mt-1 font-normal ${input}`}
              />
            </label>
            <label className="block text-sm font-medium">
              Ends (optional)
              <input
                type="datetime-local"
                value={toLocalInput(draft.ends_at)}
                onChange={(e) => set({ ends_at: fromLocalInput(e.target.value) })}
                className={`mt-1 font-normal ${input}`}
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
            Live (untick to save as a draft)
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Publish"}
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
            >
              <Eye className="size-4" /> Preview
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setEditingId(null);
              }}
              className="rounded-md px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {preview && draft && (
        <Dialog open onOpenChange={setPreview}>
          <DialogContent className="max-w-[calc(100%-2rem)] rounded-xl sm:max-w-md">
            <DialogTitle className="sr-only">Preview</DialogTitle>
            <AnnouncementCard
              announcement={draft}
              onClose={() => setPreview(false)}
              onAction={() => setPreview(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
        {announcements?.map((a) => {
          const s = status(a);
          const counts = stats?.[a.id];
          return (
            <li key={a.id} className="flex flex-wrap items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.tone}`}>
                    {s.label}
                  </span>
                  <span className="min-w-0 truncate">{a.title}</span>
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{AUDIENCE_LABELS[a.audience] ?? a.audience}</span>
                  <span>
                    {format(new Date(a.starts_at), "d MMM HH:mm")}
                    {a.ends_at ? ` – ${format(new Date(a.ends_at), "d MMM HH:mm")}` : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="size-3.5" /> {counts?.seen ?? 0} seen
                  </span>
                  {a.cta_label && (
                    <span className="flex items-center gap-1">
                      <MousePointerClick className="size-3.5" /> {counts?.clicked ?? 0} tapped
                    </span>
                  )}
                </p>
              </div>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={a.active}
                  onChange={async (e) => {
                    await setAnnouncementActive(a.id, e.target.checked).catch((err: Error) =>
                      toast.error(err.message),
                    );
                    refresh();
                  }}
                />
                Live
              </label>
              <button
                type="button"
                aria-label={`Edit ${a.title}`}
                onClick={() =>
                  start(
                    {
                      kind: a.kind,
                      release_version: a.release_version,
                      title: a.title,
                      body: a.body,
                      image_url: a.image_url,
                      cta_label: a.cta_label,
                      cta_url: a.cta_url,
                      audience: a.audience,
                      starts_at: a.starts_at,
                      ends_at: a.ends_at,
                      active: a.active,
                    },
                    a.id,
                  )
                }
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Delete ${a.title}`}
                onClick={async () => {
                  if (!window.confirm(`Delete "${a.title}"?`)) return;
                  await deleteAnnouncement(a.id).catch((err: Error) => toast.error(err.message));
                  refresh();
                }}
                className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          );
        })}
        {announcements?.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">No announcements yet.</li>
        )}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Editing a live announcement doesn't show it again to people who've already seen it — create
        a new one for that.
      </p>
    </section>
  );
}
