import { Link } from "@tanstack/react-router";
import { BadgeCheck, Building, ChevronRight, Circle, Megaphone, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useBusinessAccount } from "@/hooks/useBusinessAccount";
import { APPROVAL_LABELS, approvalOf, useBusinessFoundation } from "@/lib/businessFoundation";

/** Settings → Business account: the on switch, then a short setup checklist. */
export function BusinessAccountSettings() {
  const { enabled, switchAvailable, hasBusiness, businesses, setEnabled } = useBusinessAccount();
  const foundation = useBusinessFoundation();
  const first = businesses[0];

  function toggle(next: boolean) {
    setEnabled.mutate(next, {
      onSuccess: () =>
        toast.success(next ? "Business account on — let's set it up" : "Business tools hidden"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't update"),
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Run a garage, detailing, parts shop or other car business? Switch on a business account to
        get a business profile, photos, reviews, local listings and promotion tools. Nothing about
        businesses shows in your menus until you do.
      </p>

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-card p-4">
        <div className="flex items-center gap-3">
          <Building className="size-5 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-semibold">Business account</p>
            <p className="text-xs text-muted-foreground">
              {enabled ? "On — business tools are in your menu" : "Off"}
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          disabled={!switchAvailable || setEnabled.isPending || (enabled && hasBusiness)}
          onCheckedChange={toggle}
          aria-label="Business account"
        />
      </div>
      {!switchAvailable && !enabled && (
        <p className="text-xs text-muted-foreground">
          This switch isn&apos;t ready yet — it turns on once the latest update has been applied.
        </p>
      )}
      {enabled && hasBusiness && (
        <p className="text-xs text-muted-foreground">
          You have a business profile, so business tools stay on. Remove the business first to
          switch them off.
        </p>
      )}

      {enabled && foundation && businesses.length > 0 && (
        <ul className="space-y-1.5" aria-label="Your businesses">
          {businesses.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate font-medium">{b.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {approvalOf(b).suspended_at
                  ? "Suspended"
                  : APPROVAL_LABELS[approvalOf(b).approval_status]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {enabled && (
        <ol className="space-y-2">
          <Step
            done={hasBusiness}
            icon={Store}
            title="1. Create your business profile"
            text={
              foundation
                ? "Name, what you do and where. RevMate checks every business before anyone else can see it."
                : "Name, what you do, town and contact details."
            }
            to="/businesses/manage"
            cta={hasBusiness ? "Manage" : "Create"}
          />
          <Step
            done={false}
            icon={BadgeCheck}
            title="2. Add photos, opening hours and reply to reviews"
            text="A complete profile gets found and trusted."
            {...(first
              ? {
                  to: "/businesses/$businessId" as const,
                  params: { businessId: first.id },
                  search: { manage: true },
                }
              : {})}
            cta="Open profile"
            disabled={!first}
          />
          <Step
            done={false}
            icon={Megaphone}
            title="3. Promote your business"
            text="Get a Promoted spot in local results and ads. Always labelled as promoted."
            {...(first
              ? {
                  to: "/businesses/$businessId" as const,
                  params: { businessId: first.id },
                  search: { manage: true },
                }
              : {})}
            cta="See options"
            disabled={!first}
          />
        </ol>
      )}
    </div>
  );
}

type StepProps = {
  done: boolean;
  icon: typeof Store;
  title: string;
  text: string;
  cta: string;
  disabled?: boolean;
} & (
  | { to: "/businesses/manage"; params?: undefined; search?: undefined }
  | { to: "/businesses/$businessId"; params: { businessId: string }; search: { manage: boolean } }
  | { to?: undefined; params?: undefined; search?: undefined }
);

function Step(props: StepProps) {
  const { done, icon: Icon, title, text, cta, disabled } = props;
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-card p-3">
      {done ? (
        <BadgeCheck className="size-5 shrink-0 text-emerald-500" aria-label="Done" />
      ) : (
        <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon className="size-4 shrink-0" aria-hidden />
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
      {disabled || !props.to ? (
        <span className="text-xs text-muted-foreground">Create a profile first</span>
      ) : props.to === "/businesses/manage" ? (
        <Button asChild size="sm" variant="secondary">
          <Link to="/businesses/manage">
            {cta} <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      ) : (
        <Button asChild size="sm" variant="secondary">
          <Link to="/businesses/$businessId" params={props.params} search={props.search}>
            {cta} <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      )}
    </li>
  );
}
