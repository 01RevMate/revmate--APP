import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Check, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteFeedback,
  fetchFeedback,
  fetchLaunchStats,
  FEEDBACK_KINDS,
  FOUNDING_SPOTS,
  setFeedbackStatus,
  type AppFeedback,
  type LaunchStats,
} from "@/lib/launch";
import { displayUsernameWithoutAt } from "@/lib/usernames";

const TILES: { key: keyof LaunchStats; label: string }[] = [
  { key: "members", label: "Members" },
  { key: "joined_today", label: "Joined today" },
  { key: "joined_7d", label: "Joined this week" },
  { key: "joined_30d", label: "Joined in 30 days" },
  { key: "active_today", label: "Active today" },
  { key: "active_7d", label: "Active this week" },
  { key: "posts_7d", label: "Posts this week" },
  { key: "listings_7d", label: "Listings this week" },
  { key: "messages_7d", label: "Messages this week" },
];

const KIND_LABEL = Object.fromEntries(FEEDBACK_KINDS.map((k) => [k.value, k.label]));

/** Admin: how the launch is going (counts only) plus the feedback inbox. */
export function AdminLaunch() {
  const queryClient = useQueryClient();
  const stats = useQuery({ queryKey: ["admin", "launch-stats"], queryFn: fetchLaunchStats });
  const feedback = useQuery({ queryKey: ["admin", "feedback"], queryFn: fetchFeedback });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "feedback"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "launch-stats"] });
  }

  async function toggle(item: AppFeedback) {
    try {
      await setFeedbackStatus(item.id, item.status === "new" ? "done" : "new");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update");
    }
  }

  async function remove(item: AppFeedback) {
    if (!window.confirm("Delete this feedback?")) return;
    try {
      await deleteFeedback(item.id);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  const s = stats.data;
  const open = feedback.data?.filter((f) => f.status === "new") ?? [];
  const done = feedback.data?.filter((f) => f.status === "done") ?? [];

  return (
    <section className="mt-6 space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Launch</h2>
        <p className="text-sm text-muted-foreground">Totals only. No names, emails or locations.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {TILES.map((t) => (
            <div key={t.key} className="rounded-xl border border-border bg-card p-3">
              <p className="text-2xl font-extrabold tabular-nums">{s ? s[t.key] : "–"}</p>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </div>
          ))}
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-2xl font-extrabold tabular-nums">
              {s ? FOUNDING_SPOTS - s.founding_left : "–"}
              <span className="text-sm font-semibold text-muted-foreground">/{FOUNDING_SPOTS}</span>
            </p>
            <p className="text-xs text-muted-foreground">Founding members</p>
          </div>
        </div>
        {stats.error && (
          <p className="mt-2 text-sm text-destructive">{(stats.error as Error).message}</p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold">Feedback ({open.length} new)</h2>
        <ul className="mt-3 space-y-2">
          {[...open, ...done].map((f) => (
            <li
              key={f.id}
              className={`rounded-xl border border-border p-3 ${f.status === "done" ? "opacity-60" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${f.kind === "bug" ? "bg-destructive/15 text-destructive" : "bg-muted text-foreground"}`}
                >
                  {KIND_LABEL[f.kind]}
                </span>
                {f.profiles ? (
                  <Link
                    to="/u/$username"
                    params={{ username: f.profiles.username }}
                    className="font-semibold hover:underline"
                  >
                    @{displayUsernameWithoutAt(f.profiles.username)}
                  </Link>
                ) : (
                  <span>Deleted account</span>
                )}
                <span>{formatDistanceToNow(parseISO(f.created_at), { addSuffix: true })}</span>
                {f.page && <span className="font-mono">{f.page}</span>}
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{f.message}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => toggle(f)}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold hover:text-foreground"
                >
                  {f.status === "new" ? (
                    <>
                      <Check className="size-3.5" /> Mark done
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-3.5" /> Reopen
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => remove(f)}
                  aria-label="Delete feedback"
                  className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
          {feedback.data?.length === 0 && (
            <li className="text-sm text-muted-foreground">No feedback yet.</li>
          )}
        </ul>
      </div>
    </section>
  );
}
