import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Heart, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { NewsCard } from "@/components/NewsCard";
import {
  blankNews,
  deleteNews,
  fetchAllNews,
  NEWS_TOPICS,
  saveNews,
  setNewsActive,
  type NewsDraft,
  type NewsPost,
} from "@/lib/news";
import { isVideoUrl, uploadPostVideo, validateVideoFile } from "@/lib/social";
import { uploadImage, validateImageFile } from "@/lib/uploads";

const MAX_MEDIA = 10;
const toLocalInput = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "";

function status(n: NewsPost) {
  if (!n.active) return { label: "Off", tone: "bg-muted text-muted-foreground" };
  if (new Date(n.published_at).getTime() > Date.now())
    return { label: "Scheduled", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
  return { label: "Live", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" };
}

/**
 * Admin: RevMate News — official posts (updates, news, sponsorships, fuel
 * prices…) that appear in everyone's feed at their publish time. The
 * preview under the form shows exactly how the post will look.
 */
export function AdminNews({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data: posts } = useQuery({ queryKey: ["admin", "news"], queryFn: fetchAllNews });
  const [draft, setDraft] = useState<NewsDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customTopic, setCustomTopic] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<NewsDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const media = draft?.media ?? [];

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "news"] });
    void queryClient.invalidateQueries({ queryKey: ["news"] });
  }

  function start(next: NewsDraft, id: string | null = null) {
    setDraft(next);
    setEditingId(id);
    setCustomTopic(!NEWS_TOPICS.includes(next.topic));
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !draft) return;
    setUploading(true);
    const added: string[] = [];
    try {
      for (const file of files.slice(0, MAX_MEDIA - media.length)) {
        const video = file.type.startsWith("video/");
        const problem = video ? validateVideoFile(file) : validateImageFile(file);
        if (problem) {
          toast.error(problem);
          continue;
        }
        try {
          added.push(
            video
              ? await uploadPostVideo(userId, file)
              : await uploadImage("post-images", userId, file),
          );
        } catch (err) {
          toast.error(
            err instanceof Error ? `${file.name}: ${err.message}` : `Couldn't upload ${file.name}`,
          );
        }
      }
      if (added.length) setDraft((d) => (d ? { ...d, media: [...(d.media ?? []), ...added] } : d));
    } finally {
      setUploading(false);
    }
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!!draft.cta_label?.trim() !== !!draft.cta_url?.trim()) {
      toast.error("Add both a button label and a link, or leave both empty.");
      return;
    }
    setSaving(true);
    try {
      await saveNews(draft, editingId ?? undefined);
      toast.success(
        !draft.active
          ? "Saved as a draft (switched off)."
          : new Date(draft.published_at ?? Date.now()).getTime() > Date.now()
            ? "Scheduled."
            : "Posted to everyone's feed.",
      );
      setDraft(null);
      setEditingId(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the post.");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">RevMate News</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Official posts from RevMate that appear in everyone's feed at the time they're published —
        app updates, news, sponsorships, fuel prices. People can like them, but not comment, share
        or repost.
      </p>

      {!draft && (
        <button
          type="button"
          onClick={() => start(blankNews())}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="size-4" /> New RevMate post
        </button>
      )}

      {draft && (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={publish}
            className="space-y-3 rounded-xl border border-border bg-card p-4"
          >
            <label className="block text-sm font-medium">
              Topic
              {customTopic ? (
                <div className="mt-1 flex gap-2">
                  <input
                    value={draft.topic}
                    onChange={(e) => set({ topic: e.target.value })}
                    required
                    minLength={2}
                    maxLength={30}
                    placeholder="e.g. Track day"
                    className={`font-normal ${input}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCustomTopic(false);
                      set({ topic: NEWS_TOPICS[0]! });
                    }}
                    className="shrink-0 rounded-md border border-input px-3 text-xs"
                  >
                    List
                  </button>
                </div>
              ) : (
                <select
                  value={draft.topic}
                  onChange={(e) => {
                    if (e.target.value === "__custom") {
                      setCustomTopic(true);
                      set({ topic: "" });
                    } else
                      set({
                        topic: e.target.value,
                        sponsored: e.target.value === "Sponsored" || !!draft.sponsored,
                      });
                  }}
                  className={`mt-1 font-normal ${input}`}
                >
                  {NEWS_TOPICS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value="__custom">Custom topic…</option>
                </select>
              )}
            </label>
            <label className="block text-sm font-medium">
              Post
              <textarea
                value={draft.body}
                onChange={(e) => set({ body: e.target.value })}
                required
                maxLength={3000}
                rows={6}
                placeholder="What's the news?"
                className={`mt-1 resize-y font-normal ${input}`}
              />
              <span className="mt-1 block text-right text-xs font-normal text-muted-foreground">
                {draft.body.length}/3000
              </span>
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                Photos &amp; videos ({media.length}/{MAX_MEDIA})
              </p>
              {media.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {media.map((url) => (
                    <div
                      key={url}
                      className="relative aspect-square overflow-hidden rounded-md bg-black"
                    >
                      {isVideoUrl(url) ? (
                        <video
                          src={`${url}#t=0.1`}
                          muted
                          playsInline
                          preload="metadata"
                          className="size-full object-cover"
                        />
                      ) : (
                        <img src={url} alt="" className="size-full object-cover" />
                      )}
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => set({ media: media.filter((m) => m !== url) })}
                        className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label
                className={`inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium ${uploading || media.length >= MAX_MEDIA ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent"}`}
              >
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                {uploading ? "Uploading…" : "Add photos or videos"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                  multiple
                  className="hidden"
                  onChange={handleFiles}
                  disabled={uploading || media.length >= MAX_MEDIA}
                />
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Button label (optional)
                <input
                  value={draft.cta_label ?? ""}
                  onChange={(e) => set({ cta_label: e.target.value || null })}
                  maxLength={40}
                  placeholder="e.g. Find out more"
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
            <label className="block text-sm font-medium">
              Publish time
              <input
                type="datetime-local"
                value={toLocalInput(draft.published_at)}
                onChange={(e) =>
                  set({
                    published_at: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : new Date().toISOString(),
                  })
                }
                className={`mt-1 font-normal ${input}`}
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                It sits in the feed at this time. Pick a future time to schedule it.
              </span>
            </label>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.sponsored ?? false}
                  onChange={(e) => set({ sponsored: e.target.checked })}
                  className="size-4 accent-primary"
                />
                Paid partnership (shows "Sponsored")
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.active ?? true}
                  onChange={(e) => set({ active: e.target.checked })}
                  className="size-4 accent-primary"
                />
                Switched on
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                disabled={
                  saving || uploading || !draft.body.trim() || draft.topic.trim().length < 2
                }
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Post to feeds"}
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

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Preview — how it looks in the feed
            </p>
            <div className="mx-auto max-w-md">
              <NewsCard news={draft} preview />
            </div>
          </div>
        </div>
      )}

      <ul className="mt-6 max-w-2xl divide-y divide-border rounded-lg border border-border">
        {posts?.map((n) => {
          const s = status(n);
          return (
            <li key={n.id} className="flex flex-wrap items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.tone}`}>
                    {s.label}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {n.topic}
                  </span>
                  {n.sponsored && (
                    <span className="text-[11px] text-muted-foreground">Sponsored</span>
                  )}
                </p>
                <p className="mt-1 line-clamp-2 text-sm">{n.body}</p>
                <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{format(new Date(n.published_at), "d MMM yyyy HH:mm")}</span>
                  <span className="flex items-center gap-1">
                    <Heart className="size-3.5" /> {n.likes_count}
                  </span>
                  {n.media.length > 0 && <span>{n.media.length} media</span>}
                </p>
              </div>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={n.active}
                  onChange={async (e) => {
                    await setNewsActive(n.id, e.target.checked).catch((err: Error) =>
                      toast.error(err.message),
                    );
                    refresh();
                  }}
                />
                On
              </label>
              <button
                type="button"
                aria-label="Edit post"
                onClick={() =>
                  start(
                    {
                      topic: n.topic,
                      body: n.body,
                      media: n.media,
                      cta_label: n.cta_label,
                      cta_url: n.cta_url,
                      sponsored: n.sponsored,
                      published_at: n.published_at,
                      active: n.active,
                    },
                    n.id,
                  )
                }
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Delete post"
                onClick={async () => {
                  if (!window.confirm("Delete this RevMate post? Its likes are deleted too."))
                    return;
                  await deleteNews(n.id).catch((err: Error) => toast.error(err.message));
                  refresh();
                }}
                className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          );
        })}
        {posts?.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">No RevMate posts yet.</li>
        )}
      </ul>
    </section>
  );
}
