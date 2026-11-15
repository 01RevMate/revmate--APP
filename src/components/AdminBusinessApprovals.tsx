import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/businesses";
import {
  adminConfirmLegacyBusiness,
  adminResolveAppeal,
  adminResolveFlag,
  adminResolvePhotoReport,
  adminResolveReviewReport,
  adminReviewBusiness,
  adminReviewPhoto,
  adminReviewRevision,
  adminReviewTierRequest,
  fetchApprovalLog,
  fetchBusinessesByApproval,
  fetchLegacyBusinesses,
  fetchOpenAppeals,
  fetchOpenFlags,
  fetchOpenPhotoReports,
  fetchOpenReviewReports,
  fetchPendingPhotos,
  fetchPendingRevisions,
  fetchPendingTierRequests,
  type QueueBusiness,
  useBusinessTrust,
} from "@/lib/businessFoundation";

type Tab =
  | "pending"
  | "appealed"
  | "changes"
  | "tiers"
  | "photos"
  | "reports"
  | "legacy"
  | "flags"
  | "reviewReports"
  | "decisionAppeals";

/** Admin: the approval queue and everything else waiting on a person (migration 0080). */
export function AdminBusinessApprovals() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const pending = useQuery({
    queryKey: ["admin", "ba", "pending"],
    queryFn: () => fetchBusinessesByApproval("pending"),
  });
  const appealed = useQuery({
    queryKey: ["admin", "ba", "appealed"],
    queryFn: () => fetchBusinessesByApproval("appealed"),
  });
  const revisions = useQuery({
    queryKey: ["admin", "ba", "revisions"],
    queryFn: fetchPendingRevisions,
  });
  const tiers = useQuery({ queryKey: ["admin", "ba", "tiers"], queryFn: fetchPendingTierRequests });
  const photos = useQuery({ queryKey: ["admin", "ba", "photos"], queryFn: fetchPendingPhotos });
  const reports = useQuery({
    queryKey: ["admin", "ba", "photo-reports"],
    queryFn: fetchOpenPhotoReports,
  });
  const legacy = useQuery({ queryKey: ["admin", "ba", "legacy"], queryFn: fetchLegacyBusinesses });
  const trust = useBusinessTrust();
  const flags = useQuery({
    queryKey: ["admin", "ba", "flags"],
    queryFn: fetchOpenFlags,
    enabled: trust,
  });
  const reviewReports = useQuery({
    queryKey: ["admin", "ba", "review-reports"],
    queryFn: fetchOpenReviewReports,
    enabled: trust,
  });
  const decisionAppeals = useQuery({
    queryKey: ["admin", "ba", "decision-appeals"],
    queryFn: fetchOpenAppeals,
    enabled: trust,
  });

  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      void queryClient.invalidateQueries({ queryKey: ["businesses"] });
      void queryClient.invalidateQueries({ queryKey: ["business"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Something went wrong"),
  });

  const tabs: [Tab, string, number][] = [
    ["pending", "New", pending.data?.length ?? 0],
    ["appealed", "Appeals", appealed.data?.length ?? 0],
    ["changes", "Edits", revisions.data?.length ?? 0],
    ["tiers", "Upgrades", tiers.data?.length ?? 0],
    ["photos", "Photos", photos.data?.length ?? 0],
    ["reports", "Photo reports", reports.data?.length ?? 0],
    ["legacy", "Legacy approvals", legacy.data?.length ?? 0],
    ...(trust
      ? ([
          ["flags", "Flags", flags.data?.length ?? 0],
          ["reviewReports", "Review reports", reviewReports.data?.length ?? 0],
          ["decisionAppeals", "Decision appeals", decisionAppeals.data?.length ?? 0],
        ] as [Tab, string, number][])
      : []),
  ];

  return (
    <section
      className="mt-6 max-w-2xl rounded-2xl border border-border p-4"
      aria-label="Business approvals"
    >
      <h2 className="text-lg font-semibold">Approvals</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Nothing a member adds is public until you approve it. Check it is a genuine car business.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tabs.map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${tab === id ? "bg-primary text-primary-foreground" : "border-border"}`}
          >
            {label} {count > 0 ? `(${count})` : ""}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {(tab === "pending" || tab === "appealed") &&
          ((tab === "pending" ? pending.data : appealed.data) ?? []).map((b) => (
            <BusinessCard key={b.id} b={b} busy={act.isPending}>
              <Decision
                busy={act.isPending}
                choices={[
                  { label: "Approve", decision: "approved" },
                  ...(tab === "pending"
                    ? [{ label: "Needs changes", decision: "needs_changes", reason: true }]
                    : []),
                  { label: "Reject", decision: "rejected", reason: true },
                ]}
                onDecide={(decision, reason) =>
                  act.mutate(() =>
                    adminReviewBusiness(
                      b.id,
                      decision as "approved" | "needs_changes" | "rejected",
                      reason,
                    ),
                  )
                }
              />
            </BusinessCard>
          ))}
        {tab === "changes" &&
          (revisions.data ?? []).map((r) => (
            <div key={r.id} className="rounded-xl border border-border p-3 text-sm">
              <p className="font-semibold">{r.businesses?.name ?? "Business"}</p>
              <dl className="mt-1 space-y-1">
                {Object.entries(r.proposed).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <dt className="w-24 shrink-0 text-muted-foreground">{key}</dt>
                    <dd className="min-w-0 break-words">
                      {Array.isArray(value) ? value.join(", ") : String(value ?? "(cleared)")}
                    </dd>
                  </div>
                ))}
              </dl>
              <Decision
                busy={act.isPending}
                choices={[
                  { label: "Approve changes", decision: "approved" },
                  { label: "Reject", decision: "rejected", reason: true },
                ]}
                onDecide={(decision, reason) =>
                  act.mutate(() =>
                    adminReviewRevision(r.id, decision as "approved" | "rejected", reason),
                  )
                }
              />
            </div>
          ))}
        {tab === "tiers" &&
          (tiers.data ?? []).map((t) => (
            <div key={t.id} className="rounded-xl border border-border p-3 text-sm">
              <p className="font-semibold">
                {t.businesses?.name ?? "Business"} wants to be a full business
              </p>
              <Decision
                busy={act.isPending}
                choices={[
                  { label: "Approve", decision: "approved" },
                  { label: "Reject", decision: "rejected", reason: true },
                ]}
                onDecide={(decision, reason) =>
                  act.mutate(() =>
                    adminReviewTierRequest(t.id, decision as "approved" | "rejected", reason),
                  )
                }
              />
            </div>
          ))}
        {tab === "photos" &&
          (photos.data ?? []).map((p) => (
            <div key={p.id} className="flex gap-3 rounded-xl border border-border p-3 text-sm">
              <img
                src={p.url}
                alt=""
                className="size-24 shrink-0 rounded-lg object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.businesses?.name ?? "Business"}</p>
                <Decision
                  busy={act.isPending}
                  choices={[
                    { label: "Approve", decision: "approved" },
                    { label: "Remove", decision: "rejected" },
                  ]}
                  onDecide={(decision) =>
                    act.mutate(() => adminReviewPhoto(p.id, decision as "approved" | "rejected"))
                  }
                />
              </div>
            </div>
          ))}
        {tab === "reports" &&
          (reports.data ?? []).map((r) => (
            <div key={r.id} className="flex gap-3 rounded-xl border border-border p-3 text-sm">
              {r.business_photos && (
                <img
                  src={r.business_photos.url}
                  alt=""
                  className="size-24 shrink-0 rounded-lg object-cover"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.business_photos?.businesses?.name ?? "Business"}</p>
                <p className="text-muted-foreground">
                  {r.reason.replace(/_/g, " ")}
                  {r.details ? `: ${r.details}` : ""}
                </p>
                <Decision
                  busy={act.isPending}
                  choices={[
                    { label: "Remove photo", decision: "upheld" },
                    { label: "Dismiss", decision: "dismissed" },
                  ]}
                  onDecide={(decision) =>
                    act.mutate(() =>
                      adminResolvePhotoReport(r.id, decision as "upheld" | "dismissed"),
                    )
                  }
                />
              </div>
            </div>
          ))}
        {tab === "legacy" && (
          <>
            <p className="text-sm text-muted-foreground">
              These were live before approvals existed and stay online. Review them when you can,
              then confirm.
            </p>
            {(legacy.data ?? []).map((b) => (
              <BusinessCard key={b.id} b={b} busy={act.isPending}>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={act.isPending}
                    onClick={() => act.mutate(() => adminConfirmLegacyBusiness(b.id))}
                  >
                    Confirm reviewed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={act.isPending}
                    onClick={() => {
                      const reason = window.prompt(
                        "What does the owner need to change? They will see this.",
                      );
                      if (reason && reason.trim().length >= 3)
                        act.mutate(() => adminReviewBusiness(b.id, "needs_changes", reason.trim()));
                    }}
                  >
                    Ask for changes
                  </Button>
                </div>
              </BusinessCard>
            ))}
          </>
        )}
        {tab === "flags" &&
          (flags.data ?? []).map((f) => (
            <div key={f.id} className="rounded-xl border border-border p-3 text-sm">
              <p className="font-semibold">
                {f.businesses?.name ?? "Business"} · {f.kind.replace(/_/g, " ")}
              </p>
              <p className="text-muted-foreground">{f.detail}</p>
              {f.business_reviews && (
                <p className="mt-1 break-words rounded-md bg-muted/60 p-2">
                  {f.business_reviews.rating}★ {f.business_reviews.body || "(no text)"}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Nothing is suspended automatically. Clearing counts the review; confirming removes
                it (the owner can appeal).
              </p>
              <Decision
                busy={act.isPending}
                choices={[
                  { label: "Clear (counts)", decision: "cleared" },
                  { label: "Confirm (remove)", decision: "confirmed", reason: true },
                ]}
                onDecide={(decision, reason) =>
                  act.mutate(() =>
                    adminResolveFlag(f.id, decision as "cleared" | "confirmed", reason),
                  )
                }
              />
            </div>
          ))}
        {tab === "reviewReports" &&
          (reviewReports.data ?? []).map((r) => (
            <div key={r.id} className="rounded-xl border border-border p-3 text-sm">
              <p className="font-semibold">{r.business_reviews?.businesses?.name ?? "Business"}</p>
              <p className="break-words rounded-md bg-muted/60 p-2">
                {r.business_reviews?.rating}★ {r.business_reviews?.body || "(no text)"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {r.reason.replace(/_/g, " ")}
                {r.details ? `: ${r.details}` : ""}
              </p>
              <Decision
                busy={act.isPending}
                choices={[
                  { label: "Remove review", decision: "upheld", reason: true },
                  { label: "Dismiss", decision: "dismissed" },
                ]}
                onDecide={(decision, reason) =>
                  act.mutate(() =>
                    adminResolveReviewReport(r.id, decision as "upheld" | "dismissed", reason),
                  )
                }
              />
            </div>
          ))}
        {tab === "decisionAppeals" &&
          (decisionAppeals.data ?? []).map((a) => (
            <div key={a.id} className="rounded-xl border border-border p-3 text-sm">
              <p className="font-semibold">
                {a.businesses?.name ?? "Business"} appeals a {a.ref_kind}
              </p>
              <p className="mt-1 break-words rounded-md bg-muted/60 p-2">{a.message}</p>
              <Decision
                busy={act.isPending}
                choices={[
                  { label: "Uphold appeal (reverse)", decision: "upheld", reason: true },
                  { label: "Dismiss (final)", decision: "dismissed", reason: true },
                ]}
                onDecide={(decision, reason) =>
                  act.mutate(() =>
                    adminResolveAppeal(a.id, decision as "upheld" | "dismissed", reason ?? ""),
                  )
                }
              />
            </div>
          ))}
        {isEmpty(tab, {
          pending,
          appealed,
          revisions,
          tiers,
          photos,
          reports,
          legacy,
          flags,
          reviewReports,
          decisionAppeals,
        }) && <p className="text-sm text-muted-foreground">Nothing waiting here.</p>}
      </div>
    </section>
  );
}

function isEmpty(
  tab: Tab,
  q: Record<string, { data?: unknown[] | undefined; isLoading: boolean }>,
) {
  const key = tab === "changes" ? "revisions" : tab;
  const query = q[key];
  return !!query && !query.isLoading && (query.data?.length ?? 0) === 0;
}

function BusinessCard({
  b,
  busy,
  children,
}: {
  b: QueueBusiness;
  busy: boolean;
  children: React.ReactNode;
}) {
  const [showLog, setShowLog] = useState(false);
  const log = useQuery({
    queryKey: ["admin", "ba", "log", b.id],
    queryFn: () => fetchApprovalLog(b.id),
    enabled: showLog,
  });
  return (
    <div className="rounded-xl border border-border p-3 text-sm" aria-busy={busy}>
      <p className="font-semibold">{b.name}</p>
      <p className="text-muted-foreground">
        {BUSINESS_CATEGORY_LABELS[b.category] ?? b.category}
        {b.town ? ` · ${b.town}` : ""}
      </p>
      {b.description && <p className="mt-1 break-words">{b.description}</p>}
      <p className="mt-1 break-words text-xs text-muted-foreground">
        {[b.website, b.phone, b.email, b.address].filter(Boolean).join(" · ") ||
          "No contact details given"}
      </p>
      {b.appeal_message && (
        <p className="mt-2 rounded-md bg-muted/60 p-2">
          <strong>Appeal:</strong> {b.appeal_message}
        </p>
      )}
      {b.review_reason && (
        <p className="mt-1 text-xs text-muted-foreground">Last note: {b.review_reason}</p>
      )}
      {children}
      <button
        type="button"
        className="mt-2 text-xs text-muted-foreground underline"
        onClick={() => setShowLog((v) => !v)}
      >
        {showLog ? "Hide history" : "History"}
      </button>
      {showLog && (
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {(log.data ?? []).map((l) => (
            <li key={l.id}>
              {new Date(l.created_at).toLocaleString("en-GB")} · {l.kind}: {l.from_status ?? "—"} →{" "}
              {l.to_status ?? "—"}
              {l.reason ? ` (${l.reason})` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Decision({
  choices,
  onDecide,
  busy,
}: {
  choices: { label: string; decision: string; reason?: boolean }[];
  onDecide: (decision: string, reason?: string) => void;
  busy: boolean;
}) {
  const [asking, setAsking] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const pick = choices.find((c) => c.decision === asking);
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <Button
            key={c.decision}
            size="sm"
            variant={c.decision === "approved" ? "default" : "outline"}
            disabled={busy}
            onClick={() => (c.reason ? setAsking(c.decision) : onDecide(c.decision))}
          >
            {busy && asking === null && <Loader2 className="animate-spin" />} {c.label}
          </Button>
        ))}
      </div>
      {pick && (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Tell the owner why. They will see this."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || reason.trim().length < 3}
              onClick={() => {
                onDecide(pick.decision, reason.trim());
                setAsking(null);
                setReason("");
              }}
            >
              Send: {pick.label}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
