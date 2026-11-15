import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  APPROVAL_LABELS,
  appealBusiness,
  approvalOf,
  fetchOpenRevision,
  fetchOpenTierRequest,
  requestBusinessTier,
  submitBusiness,
  withdrawBusinessRevision,
} from "@/lib/businessFoundation";
import type { BusinessProfile } from "@/lib/businesses";

/** What the owner sees at the top of their business: where it is in review and what to do next. */
export function BusinessStatusPanel({ business }: { business: BusinessProfile }) {
  const queryClient = useQueryClient();
  const a = approvalOf(business);
  const [appealText, setAppealText] = useState("");
  const revision = useQuery({
    queryKey: ["business-revision", business.id],
    queryFn: () => fetchOpenRevision(business.id),
    enabled: a.approval_status === "approved",
  });
  const tierRequest = useQuery({
    queryKey: ["business-tier-request", business.id],
    queryFn: () => fetchOpenTierRequest(business.id),
    enabled: a.approval_status === "approved",
  });

  function changed() {
    void queryClient.invalidateQueries({ queryKey: ["business", business.id] });
    void queryClient.invalidateQueries({ queryKey: ["my-businesses"] });
    void queryClient.invalidateQueries({ queryKey: ["business-revision", business.id] });
    void queryClient.invalidateQueries({ queryKey: ["business-tier-request", business.id] });
  }
  const run = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: changed,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Something went wrong"),
  });

  const status = a.approval_status;
  let tone = "border-border bg-muted/40";
  let icon = <Clock className="size-5 shrink-0 text-muted-foreground" aria-hidden />;
  let body: React.ReactNode = null;

  if (a.suspended_at) {
    tone = "border-red-500/40 bg-red-500/10";
    icon = <ShieldAlert className="size-5 shrink-0 text-red-500" aria-hidden />;
    body = (
      <p className="text-sm">
        This business is suspended and hidden from everyone.
        {a.suspended_reason ? ` Reason: ${a.suspended_reason}` : ""} Contact RevMate if you think
        this is a mistake.
      </p>
    );
  } else if (status === "draft") {
    body = (
      <>
        <p className="text-sm">
          Only you can see this. Finish your profile, then send it to RevMate to be approved. It
          goes public once it is approved.
        </p>
        <Button
          className="mt-3"
          disabled={run.isPending}
          onClick={() => run.mutate(() => submitBusiness(business.id))}
        >
          {run.isPending && <Loader2 className="animate-spin" />} Submit for approval
        </Button>
      </>
    );
  } else if (status === "pending") {
    body = (
      <p className="text-sm">
        We're checking your business is a genuine car business. Only you can see it until it's
        approved.
      </p>
    );
  } else if (status === "needs_changes") {
    tone = "border-amber-500/40 bg-amber-500/10";
    body = (
      <>
        <p className="text-sm">RevMate needs a few changes before approving this business.</p>
        {a.review_reason && (
          <p className="mt-2 rounded-md bg-background/60 p-2 text-sm">{a.review_reason}</p>
        )}
        <Button
          className="mt-3"
          disabled={run.isPending}
          onClick={() => run.mutate(() => submitBusiness(business.id))}
        >
          {run.isPending && <Loader2 className="animate-spin" />} Submit again
        </Button>
      </>
    );
  } else if (status === "rejected") {
    tone = "border-red-500/40 bg-red-500/10";
    icon = <XCircle className="size-5 shrink-0 text-red-500" aria-hidden />;
    body = (
      <>
        <p className="text-sm">This business wasn't approved.</p>
        {a.review_reason && (
          <p className="mt-2 rounded-md bg-background/60 p-2 text-sm">{a.review_reason}</p>
        )}
        {a.appeal_used ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Your appeal has been reviewed, so this decision is final.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            <label className="block text-sm font-medium">
              Think we got it wrong? Tell us why (you can appeal once)
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                maxLength={1000}
                value={appealText}
                onChange={(e) => setAppealText(e.target.value)}
              />
            </label>
            <Button
              variant="outline"
              disabled={run.isPending || appealText.trim().length < 10}
              onClick={() => run.mutate(() => appealBusiness(business.id, appealText.trim()))}
            >
              Appeal this decision
            </Button>
          </div>
        )}
      </>
    );
  } else if (status === "appealed") {
    body = (
      <p className="text-sm">
        We've got your appeal and will look again. You'll see the result here.
      </p>
    );
  } else {
    tone = "border-emerald-500/40 bg-emerald-500/10";
    icon = <CheckCircle2 className="size-5 shrink-0 text-emerald-500" aria-hidden />;
    body = (
      <div className="space-y-2 text-sm">
        <p>
          Live on RevMate · {a.tier === "full" ? "Full business" : "Listing"}
          {business.legacy_approved ? " · Approved before approvals began" : ""}
        </p>
        {revision.data && (
          <div className="rounded-md bg-background/60 p-2">
            <p className="font-medium">Your changes are waiting for approval.</p>
            <p className="text-muted-foreground">
              Your profile stays live as it was until they're approved.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={run.isPending}
              onClick={() => run.mutate(() => withdrawBusinessRevision(revision.data!.id))}
            >
              Withdraw changes
            </Button>
          </div>
        )}
        {a.tier === "listing" &&
          (tierRequest.data ? (
            <p className="text-muted-foreground">
              Your request to become a full business is waiting for approval.
            </p>
          ) : (
            <div>
              <p className="text-muted-foreground">
                Full businesses get their own followers, enquiries and (later) promotion tools.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                disabled={run.isPending}
                onClick={() => run.mutate(() => requestBusinessTier(business.id))}
              >
                Request full business
              </Button>
            </div>
          ))}
      </div>
    );
  }

  return (
    <section className={`mt-4 rounded-2xl border p-4 ${tone}`} aria-label="Approval status">
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold">
            {a.suspended_at ? "Suspended" : APPROVAL_LABELS[status]}
          </h2>
          <div className="mt-1">{body}</div>
        </div>
      </div>
    </section>
  );
}
