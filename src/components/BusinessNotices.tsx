import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  appealDecision,
  fetchAppealableNotices,
  type BusinessNotice,
} from "@/lib/businessFoundation";
import type { BusinessProfile } from "@/lib/businesses";

const WORDS: Record<string, string> = {
  report_upheld: "A report about your business was upheld",
  flag_confirmed: "A review was removed after a conflict-of-interest check",
  review_hidden: "A review was removed after a report",
};
const KIND: Record<string, "report" | "flag" | "review"> = {
  report_upheld: "report",
  flag_confirmed: "flag",
  review_hidden: "review",
};

/**
 * Owner-only: decisions that went against the business, with a way to appeal each one once.
 * Nothing here is automatic; an admin decided every item and an admin decides every appeal.
 */
export function BusinessNotices({ business }: { business: BusinessProfile }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const { data } = useQuery({
    queryKey: ["business-notices", business.id],
    queryFn: () => fetchAppealableNotices(business.id),
  });
  const appeal = useMutation({
    mutationFn: (n: { kind: "report" | "flag" | "review" | "suspension"; ref: string }) =>
      appealDecision(business.id, n.kind, n.ref, message.trim()),
    onSuccess: () => {
      toast.success("Appeal sent. A RevMate admin will look at it and reply here.");
      setOpen(null);
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["business-notices", business.id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't send the appeal"),
  });

  const items: {
    id: string;
    text: string;
    kind: "report" | "flag" | "review" | "suspension";
    ref: string;
    note: string | null;
  }[] = [];
  if (business.suspended_at) {
    items.push({
      id: "suspension",
      text: "Your business is suspended",
      kind: "suspension",
      ref: business.id,
      note: business.suspended_reason ?? null,
    });
  }
  for (const n of data?.notices ?? ([] as BusinessNotice[])) {
    if (!n.ref_id || !WORDS[n.kind]) continue;
    items.push({
      id: n.id,
      text: WORDS[n.kind]!,
      kind: KIND[n.kind]!,
      ref: n.ref_id,
      note: n.reason,
    });
  }
  if (items.length === 0) return null;

  return (
    <section
      className="mt-4 rounded-2xl border border-border p-4"
      aria-label="Decisions you can appeal"
    >
      <h2 className="text-sm font-bold">Decisions you can appeal</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        You can appeal each decision once. A RevMate admin reviews it. We never suspend a business
        automatically.
      </p>
      <ul className="mt-3 space-y-3">
        {items.map((i) => {
          const done = data?.appealed.has(i.ref) ?? false;
          return (
            <li key={i.id} className="text-sm">
              <p className="font-medium">{i.text}</p>
              {i.note && <p className="text-muted-foreground">{i.note}</p>}
              {done ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Appeal sent. We'll update this when it's decided.
                </p>
              ) : open === i.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Tell us why this should be looked at again"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={appeal.isPending || message.trim().length < 10}
                      onClick={() => appeal.mutate({ kind: i.kind, ref: i.ref })}
                    >
                      Send appeal
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  onClick={() => {
                    setOpen(i.id);
                    setMessage("");
                  }}
                >
                  Appeal
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
