import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { issueSystemLabel, setIssueStatus } from "@/lib/diagnostics";

/**
 * On diagnostic posts: which part of the car, whether it's fixed, and the
 * fix. The author marks it with one tap; when they mark it fixed everyone
 * who liked or commented is told (by the database).
 */
export function IssueStatusBar({
  postId,
  system,
  status,
  fix,
  isAuthor,
}: {
  postId: string;
  system: string | null;
  status: string | null;
  fix: string | null;
  isAuthor: boolean;
}) {
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState(status);
  const [currentFix, setCurrentFix] = useState(fix);
  const [writingFix, setWritingFix] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const resolved = current === "resolved";

  async function mark(next: "resolved" | "unresolved", fixText?: string) {
    setBusy(true);
    try {
      await setIssueStatus(postId, next, fixText);
      setCurrent(next);
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
    <div
      className={`mt-3 rounded-lg border p-3 text-sm ${resolved ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {resolved ? (
          <CheckCircle2 className="size-4 text-emerald-600" />
        ) : (
          <CircleAlert className="size-4 text-amber-600" />
        )}
        <span className="font-semibold">{resolved ? "Fixed" : "Unresolved"}</span>
        {system && (
          <span className="text-xs text-muted-foreground">· {issueSystemLabel(system)}</span>
        )}
        {isAuthor && !writingFix && (
          <div className="ml-auto flex gap-1.5">
            {resolved ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void mark("unresolved")}
                className="rounded-full border border-input bg-background px-3 py-1 text-xs font-medium"
              >
                It's back
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setWritingFix(true)}
                className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
              >
                ✅ I fixed it
              </button>
            )}
          </div>
        )}
      </div>
      {resolved && currentFix && (
        <p className="mt-1.5 whitespace-pre-wrap">
          <span className="font-semibold">The fix: </span>
          {currentFix}
        </p>
      )}
      {!resolved && !isAuthor && (
        <p className="mt-1 text-xs text-muted-foreground">
          Had this too? Comment with what fixed it, or like it to be told when it's sorted.
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
