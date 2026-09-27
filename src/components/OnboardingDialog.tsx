import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgePoundSterling,
  Check,
  Fuel,
  MessageCircleQuestion,
  Search,
  Users,
} from "lucide-react";
import { setHomeMode } from "@/hooks/useHomeMode";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Avatar } from "@/components/Avatar";
import { CarLogo } from "@/components/CarLogo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { APPROVED_VEHICLE_MAKES } from "@/lib/approvedVehicleMakes";
import { completeOnboarding, fetchSuggestedProfiles } from "@/lib/engagement";
import { useEngagementFeatures } from "@/lib/features";
import { followProfile } from "@/lib/follows";
import { displayUsernameWithoutAt } from "@/lib/usernames";

// The makes most UK enthusiasts pick, shown first before searching.
const POPULAR_MAKES = [
  "BMW",
  "Audi",
  "Mercedes-Benz",
  "Volkswagen",
  "Ford",
  "Porsche",
  "Toyota",
  "Honda",
  "Nissan",
  "Subaru",
  "Mazda",
  "Vauxhall",
  "Land Rover",
  "Tesla",
];

const USES = [
  {
    id: "community",
    label: "Show off my car & chat",
    hint: "The feed, battles, stories and meets",
    icon: Users,
  },
  {
    id: "marketplace",
    label: "Buy & sell cars and parts",
    hint: "The marketplace",
    icon: BadgePoundSterling,
  },
  {
    id: "help",
    label: "Get help and research cars",
    hint: "Faults, fixes and specs",
    icon: MessageCircleQuestion,
  },
  {
    id: "running_costs",
    label: "Save on running costs",
    hint: "Fuel prices and EV chargers — coming soon",
    icon: Fuel,
  },
];

/**
 * First-run setup: pick the makes you're into, then follow a few people so
 * the feed is full from day one. Shown once (Skip counts as done).
 */
export function OnboardingDialog() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const enabled = useEngagementFeatures();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"uses" | "makes" | "people">("uses");
  const [uses, setUses] = useState<string[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const open = !!user && !!profile && enabled && !profile.onboarded_at && !dismissed;

  const { data: suggestions } = useQuery({
    queryKey: ["suggested-profiles", user?.id, step],
    queryFn: () => fetchSuggestedProfiles(12),
    enabled: open && step === "people",
  });

  const makeOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    const available = new Set(APPROVED_VEHICLE_MAKES.map((m) => m.toLowerCase()));
    const popular = POPULAR_MAKES.filter((m) => available.has(m.toLowerCase()));
    if (!term) return popular;
    return APPROVED_VEHICLE_MAKES.filter((m) => m.toLowerCase().includes(term)).slice(0, 24);
  }, [search]);

  async function finish(skip: boolean) {
    if (!user) return;
    setSaving(true);
    try {
      // Saving the makes is what makes the For You feed personal.
      await completeOnboarding(user.id, skip ? [] : makes);
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      setDismissed(true);
      if (!skip) toast.success("Your feed is ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your choices");
    } finally {
      setSaving(false);
    }
  }

  async function follow(userId: string) {
    if (!user || followed.has(userId)) return;
    setFollowed((prev) => new Set(prev).add(userId));
    try {
      await followProfile(user.id, userId);
    } catch {
      setFollowed((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }

  function toggleMake(make: string) {
    setMakes((prev) =>
      prev.includes(make)
        ? prev.filter((m) => m !== make)
        : prev.length < 20
          ? [...prev, make]
          : prev,
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && void finish(true)}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
        {step === "uses" ? (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>What will you use RevMate for?</DialogTitle>
              <DialogDescription>
                Pick as many as you like — you can change this any time.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {USES.map((use) => {
                const selected = uses.includes(use.id);
                return (
                  <button
                    key={use.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setUses((prev) =>
                        prev.includes(use.id)
                          ? prev.filter((id) => id !== use.id)
                          : [...prev, use.id],
                      )
                    }
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}
                  >
                    <use.icon className="size-5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{use.label}</span>
                      <span className="block text-xs text-muted-foreground">{use.hint}</span>
                    </span>
                    {selected && <Check className="size-4 text-primary" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => void finish(true)}
                disabled={saving}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Skip
              </button>
              <button
                type="button"
                disabled={uses.length === 0 || saving}
                onClick={() => {
                  // Not here for the community side? Start them on Essentials
                  // and skip the "follow people" step.
                  const community = uses.includes("community");
                  setHomeMode(community ? "community" : "essentials");
                  if (community) setStep("makes");
                  else void finish(false);
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        ) : step === "makes" ? (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>What are you into?</DialogTitle>
              <DialogDescription>
                Pick the makes you love and we'll fill your feed with them.
              </DialogDescription>
            </DialogHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search makes"
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {makeOptions.map((make) => {
                const selected = makes.includes(make);
                return (
                  <button
                    key={make}
                    type="button"
                    onClick={() => toggleMake(make)}
                    aria-pressed={selected}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${selected ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"}`}
                  >
                    <CarLogo make={make} className="size-4 rounded-full bg-white p-0.5" />
                    {make}
                    {selected && <Check className="size-3.5" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => void finish(true)}
                disabled={saving}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => setStep("people")}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                {makes.length ? `Next (${makes.length})` : "Next"}
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>People to follow</DialogTitle>
              <DialogDescription>
                Follow a few owners so there's always something new in your feed.
              </DialogDescription>
            </DialogHeader>
            <ul className="divide-y divide-border">
              {suggestions?.map((person) => {
                const isFollowed = followed.has(person.user_id);
                return (
                  <li key={person.user_id} className="flex items-center gap-3 py-2.5">
                    <Avatar
                      photoUrl={person.avatar_url}
                      fallback={person.username}
                      className="size-10"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {displayUsernameWithoutAt(person.username)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{person.reason}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void follow(person.user_id)}
                      disabled={isFollowed}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${isFollowed ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}
                    >
                      {isFollowed ? "Following" : "Follow"}
                    </button>
                  </li>
                );
              })}
              {suggestions?.length === 0 && (
                <li className="py-4 text-sm text-muted-foreground">
                  No suggestions yet — you'll find people as you explore.
                </li>
              )}
            </ul>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep("makes")}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void finish(false)}
                disabled={saving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Saving…" : "Done"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
