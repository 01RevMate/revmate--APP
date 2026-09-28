import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setIssueStatus } from "@/lib/diagnostics";

/**
 * On diagnostic posts: which part of the car, whether it's fixed, and the
 * fix. The author marks it with one tap; when they mark it fixed everyone
 * who liked or commented is told (by the database).
 */
export function IssueStatusBar({
  postId,
  status,
  fix,
  isAuthor,
  onStatusChange,
}: {
  postId: string;
  status: string | null;
  fix: string | null;
  isAuthor: boolean;
  onStatusChange?: (status: "resolved" | "unresolved") => void;
}) {
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState(status);
  const [currentFix, setCurrentFix] = useState(fix);
  const [writingFix, setWritingFix] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const resolved = current === "resolved";

  if (!isAuthor && !(resolved && currentFix)) return null;

  async function mark(next: "resolved" | "unresolved", fixText?: string) {
    setBusy(true);
    try {
      await setIssueStatus(postId, next, fixText);
      setCurrent(next);
      onStatusChange?.(next);
      if (next === "resolved") setCurrentFix(fixText?.trim() || null);
      setWritingFix(false);
      toast.success(
        next === "resolved"
          ? "Marked as fixed — people who followed it have been told."
          : "Marked as still a problem.",
      );
      void queryClient.invalidateQueries({ queryKey: ["common-issues"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {isAuthor && !writingFix && (
          <div className="flex gap-1.5">
            {resolved ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void mark("unresolved")}
                className="rounded-full border border-input bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                It's back
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setWritingFix(true)}
                className="rounded-full border border-emerald-600/30 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
              >
                Mark fixed
              </button>
            )}
          </div>
        )}
      </div>
      {resolved && currentFix && (
        <p className="mt-2 whitespace-pre-wrap border-l-2 border-emerald-500/50 pl-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Fix: </span>
          {currentFix}
        </p>
      )}
      {writingFix && (
        <div className="mt-2 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            rows={2}
            autoFocus
            placeholder="What fixed it? e.g. Replaced the coil pack on cylinder 3 — £40 part"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void mark("resolved", draft)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {busy && <Loader2 className="size-3 animate-spin" />}
              {draft.trim() ? "Save fix" : "Mark fixed without details"}
            </button>
            <button
              type="button"
              onClick={() => setWritingFix(false)}
              className="rounded-md px-3 py-1.5 text-xs hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
