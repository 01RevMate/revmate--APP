import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { searchRadius, bandWithinRadius, RANGE_SAFETY_MILES } from "@/lib/rangeRadius";
import { fetchChargers, boundsAround, kmBetween, type Charger } from "@/lib/evChargers";
import { LendawattIntro } from "@/components/LendawattIntro";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { fetchOrCreateConversation, sendMessage } from "@/lib/messages";
import { CompatibilityNote, useChargerCompat } from "@/components/ChargerCompatibility";
import { CommunityChargerLogo } from "@/components/CommunityChargerLogo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Loader2,
  MapPin,
  Phone,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { lookupDistrict } from "@/lib/marketDeals";
import { attachImagesToPost, createPost } from "@/lib/posts";
import { uploadImageBlob } from "@/lib/uploads";
import {
  CONNECTOR_LABEL,
  FITS_LABEL,
  deleteMyHost,
  fetchMyHost,
  fetchCommunityStats,
  fetchMyRequests,
  findNearbyHosts,
  fetchHostReviews,
  leaveHostReview,
  requestCharge,
  respondToRequest,
  saveMyHost,
  type ChargeRequest,
  type ChargerHost,
  type NearbyHost,
} from "@/lib/communityChargers";

const URL = "https://revmate.co.uk/ev-chargers/community";
const TITLE = "Lendawatt by RevMate — borrow a home EV charger when you're stranded";
const DESC =
  "Lendawatt is RevMate's community of EV owners. Low on range with no public charger nearby? Members can offer their home charger in an emergency, free or for a small fee. Private, opt-in and arranged between drivers.";

export const Route = createFileRoute("/ev-chargers_/community")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: "Lendawatt by RevMate — EV drivers lending a watt" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  validateSearch: (s: Record<string, unknown>): { tab?: Tab | undefined } =>
    ({ tab: TABS.includes(s["tab"] as Tab) ? (s["tab"] as Tab) : undefined }),
  component: CommunityChargersPage,
});

type Tab = "need" | "host" | "requests" | "settings";
const TABS: Tab[] = ["need", "host", "requests", "settings"];

const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Something went wrong");

function CommunityChargersPage() {
  const { user } = useAuth();
  const { open: openAuth } = useAuthModal();
  const search = Route.useSearch();
  const [tab, setTab] = useState<Tab>(search.tab ?? "need");
  const [group, setGroup] = useState<"driver" | "hosting">(search.tab === "host" || search.tab === "settings" ? "hosting" : "driver");
  useEffect(() => {
    if (search.tab) {
      setTab(search.tab);
      if (search.tab === "host" || search.tab === "settings") setGroup("hosting");
      else if (search.tab === "need") setGroup("driver");
    }
  }, [search.tab]);

  return (
    <div className="charge-theme lw-edge min-h-screen">
      <LendawattIntro />
    <div className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <Link to="/ev-chargers" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> EV chargers
      </Link>
      <header className="mt-8 text-center text-foreground">
        <LendawattBrand />
        <h1 className="mt-5 text-3xl font-extrabold leading-tight">Lendawatt</h1>
        <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-muted-foreground">EV drivers helping each other when the range runs low.</p>
        <NetworkStats />
      </header>

      {!user ? (
        <div className="mt-10">
          <p className="text-base">Sign in to find a member's charger or offer yours. It's for members aged 18 and over.</p>
          <Button className="mt-3" onClick={() => openAuth("Create a free account to join the community charger network.")}>
            Sign in or join
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-3">
            {([
              ["driver", "I need a charge", "Find a host nearby", "need"],
              ["hosting", "My charger", "Share yours, manage it", "host"],
            ] as const).map(([g, title, sub, first]) => {
              const active = g === "driver" ? tab === "need" || (tab === "requests" && group === "driver") : tab === "host" || tab === "settings" || (tab === "requests" && group === "hosting");
              return (
                <button
                  key={g}
                  onClick={() => { setGroup(g); setTab(first); }}
                  className={`rounded-2xl border-2 p-4 text-center transition-all ${active ? "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_var(--primary)]" : "border-primary/40 bg-primary/15 hover:border-primary"}`}
                >
                  <span className="block font-semibold">{title}</span>
                  <span className={`mt-0.5 block text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{sub}</span>
                </button>
              );
            })}
          </div>
          <nav className="-mx-4 mt-6 flex gap-6 overflow-x-auto border-b border-border px-4 text-sm">
            {(group === "driver"
              ? ([["need", "Find a charge"], ["requests", "My requests"]] as const)
              : ([["host", "My charger"], ["requests", "Requests"], ["settings", "Settings"]] as const)
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`-mb-px shrink-0 border-b-2 pb-3 font-semibold transition-colors ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-8">
          {tab === "need" && <NeedCharge onSent={() => setTab("requests")} />}
          {tab === "host" && <HostSetup userId={user.id} onSettings={() => { setGroup("hosting"); setTab("settings"); }} />}
          {tab === "requests" && <Requests />}
          {tab === "settings" && <SettingsPanel userId={user.id} onHost={() => { setGroup("hosting"); setTab("host"); }} />}
          </div>
        </>
      )}

      <details className="group mt-14 border-t border-border pt-6 text-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-muted-foreground"><ShieldAlert className="size-4" /> How it works and staying safe <span className="ml-auto text-xs group-open:hidden">Show</span></summary>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Any arrangement is between members. RevMate doesn't check chargers or homes, and it isn't part of any deal.</li>
          <li>RevMate never takes or handles money. If a host charges, you agree it with them directly.</li>
          <li>Hosts are responsible for their own charger and cable. Drivers should use their own cable where they can.</li>
          <li>If you're in danger, call 999. For a breakdown, call your breakdown cover first.</li>
          <li>Hosts can see the profile of anyone who asks, and drivers can see the host's profile, so you know who you're meeting.</li>
          <li>Everything is arranged inside RevMate. Phone numbers are never shared.</li>
          <li>Hosts' location is kept to about 1 km. An exact meeting place is only shown to the driver the host approves, and it's deleted after 4 hours.</li>
        </ul>
      </details>
      <StrandedPanel />
    </div>
    </div>
  );
}

function LendawattBrand() {
  return (
    <div className="text-center">
      <p className="mb-4 text-xs font-bold uppercase text-primary">Lendawatt Community · by RevMate</p>
      <div className="flex items-center justify-center gap-5">
        <img src="/brand/revmate-logo-dark.png" alt="RevMate" className="h-12 w-20 object-contain" />
        <span className="text-xl text-muted-foreground" aria-hidden="true">+</span>
        <CommunityChargerLogo className="size-16" />
      </div>
    </div>
  );
}

function StrandedPanel() {
  return (
    <div className="lw-help mt-8 rounded-lg border border-destructive/60 bg-destructive/10 p-5 text-sm">
      <p className="flex items-center justify-center gap-2 font-semibold"><Phone className="size-4" /> Stranded right now?</p>
      <p className="mt-2 text-center leading-relaxed text-muted-foreground">
        If you're unsafe, call <a className="font-semibold text-foreground underline" href="tel:999">999</a>. On a motorway, National Highways is on{" "}
        <a className="font-semibold text-foreground underline" href="tel:03001235000">0300 123 5000</a>. Many breakdown services can tow an EV to a charger.{" "}
        <Link to="/ev-chargers" className="font-semibold text-foreground underline">See public chargers on the map</Link>.
      </p>
    </div>
  );
}

function NeedCharge({ onSent }: { onSent: () => void }) {
  const [postcode, setPostcode] = useState("");
  const [emergency, setEmergency] = useState(true);
  const [milesLeft, setMilesLeft] = useState("");
  const radius = searchRadius(milesLeft ? Number(milesLeft) : null);
  const [busy, setBusy] = useState(false);
  const [hosts, setHosts] = useState<NearbyHost[] | null>(null);
  const compat = useChargerCompat(hosts);
  const [asking, setAsking] = useState<NearbyHost | null>(null);

  const [publicNear, setPublicNear] = useState<{ c: Charger; miles: number }[] | null>(null);
  async function search(lat: number, lng: number) {
    setPublicNear(null);
    const found = (await findNearbyHosts(lat, lng, emergency)).filter((h) => bandWithinRadius(h.band_order, radius));
    if (found.length === 0) {
      const km = Math.min(15, Math.max(5, (radius || 3) * 1.609));
      try {
        const ctrl = new AbortController();
        const list = await Promise.race([
          fetchChargers(boundsAround(lat, lng, km), ctrl.signal),
          new Promise<never>((_, rej) => setTimeout(() => { ctrl.abort(); rej(new Error("timeout")); }, 12000)),
        ]);
        setPublicNear(
          list
            .filter((c) => c.working !== false)
            .map((c) => ({ c, miles: kmBetween(lat, lng, c.lat, c.lng) / 1.609 }))
            .filter((x) => x.miles <= Math.max(3, radius || 3))
            .sort((a, b) => a.miles - b.miles)
            .slice(0, 6),
        );
      } catch {
        setPublicNear([]);
      }
    }
    setHosts(found);
  }
  async function byPostcode() {
    setBusy(true);
    try {
      const p = await lookupDistrict(postcode);
      await search(p.lat, p.lng);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  function byGps() {
    if (!navigator.geolocation) {
      toast.error("Your device can't share location — enter a postcode.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await search(Math.round(pos.coords.latitude * 100) / 100, Math.round(pos.coords.longitude * 100) / 100);
        } catch (e) {
          toast.error(errMsg(e));
        } finally {
          setBusy(false);
        }
      },
      () => {
        setBusy(false);
        toast.error("Couldn't get your location — enter a postcode instead.");
      },
    );
  }

  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<NearbyHost | null>(null);
  const miles = milesLeft ? Number(milesLeft) : 0;
  const goResults = async (fn: () => Promise<void> | void) => {
    await fn();
  };
  useEffect(() => {
    if (hosts) setStep(2);
  }, [hosts]);
  const STEPS = ["Range", "Location", "Hosts", "Charge"];

  const [open, setOpen] = useState(false);
  function close(o: boolean) {
    setOpen(o);
    if (!o) { setStep(0); setHosts(null); setPicked(null); setPublicNear(null); }
  }

  return (
    <>
    <div className="lw-box space-y-4 rounded-lg border border-primary bg-card p-6 text-center sm:p-8">
      <p className="text-lg font-semibold">Low on range?</p>
      <p className="text-sm text-muted-foreground">Find a Lendawatt host or public charger within reach.</p>
      <Button className="h-14 w-full text-base shadow-[0_0_18px_var(--primary)]" onClick={() => setOpen(true)}>⚡ Find a charge</Button>
    </div>
    <Dialog open={open} onOpenChange={close}>
    <DialogContent className="charge-theme lw-wizard max-h-[85dvh] max-sm:top-4 max-sm:translate-y-0 w-[calc(100%-1.5rem)] overflow-y-auto rounded-lg p-5 sm:max-w-xl sm:p-8">
    <div className="pb-2 pt-2">
      <LendawattBrand />
      <DialogTitle className="mt-5 text-center text-2xl">Find a charge</DialogTitle>
      <DialogDescription className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">A little help to get you on your way.</DialogDescription>
    </div>
    <div className="space-y-7">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
        <span className="font-semibold tabular-nums text-primary">{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
      </div>
      <ol className="-mt-4 flex gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <button
              type="button"
              disabled={i > step}
              onClick={() => { setStep(i); if (i < 3) setPicked(null); }}
              className={`h-1.5 w-full rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
              aria-label={`Step ${i + 1}: ${s}`}
            />
            <span className={`mt-1.5 block text-xs ${i === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s}</span>
          </li>
        ))}
      </ol>

      <div key={step} className="animate-in fade-in slide-in-from-right-6 duration-300">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <p className="text-center text-xl font-semibold leading-snug">How many miles have you got left?</p>
              <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">We keep {RANGE_SAFETY_MILES} miles spare in case your range is optimistic.</p>
            </div>
            <label className="flex items-baseline justify-center gap-2 rounded-lg border border-primary/40 bg-card px-4 py-7 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <input
                inputMode="numeric"
                enterKeyHint="done"
                onFocus={(e) => { const el = e.currentTarget; setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300); }}
                value={milesLeft}
                onChange={(e) => setMilesLeft(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="0"
                aria-label="Miles left"
                className="w-36 bg-transparent text-center text-6xl font-bold tabular-nums text-primary outline-none placeholder:text-primary/30"
              />
              <span className="text-lg font-medium text-muted-foreground">miles</span>
            </label>
            {milesLeft && (
              <p className="text-center text-sm text-muted-foreground">
                {radius > 0 ? `We'll look within ${radius} miles.` : "That's very low — we'll show only the closest hosts. Call your breakdown cover too."}
              </p>
            )}
            <div>
              <p className="text-center text-sm font-semibold">Is this an emergency?</p>
              <div className="mt-3 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Is this an emergency?">
                {([[true, "🚨 Yes", "I can't reach a public charger"], [false, "🗓️ No", "Planning ahead"]] as const).map(([v, t, sub]) => (
                  <Button
                    variant="outline"
                    key={String(v)}
                    type="button"
                    role="radio"
                    aria-checked={emergency === v}
                    onClick={() => setEmergency(v)}
                    className={`h-auto min-h-24 flex-col gap-1 whitespace-normal rounded-lg border p-3 text-center transition-all ${emergency === v ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card text-foreground"}`}
                  >
                    <span className="block font-semibold">{t}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{sub}</span>
                  </Button>
                ))}
              </div>
            </div>
            <Button className="h-12 w-full" disabled={!milesLeft} onClick={() => setStep(1)}>Next</Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <p className="text-lg font-semibold">Where are you?</p>
              <p className="mt-1 text-sm text-muted-foreground">Rounded to about 1 km, used for this search only and not saved.</p>
            </div>
            <Input className="h-12" value={postcode} onChange={(e) => setPostcode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && postcode.trim() && goResults(byPostcode)} placeholder="Postcode or area, e.g. LS6" />
            <Button className="h-12 w-full" onClick={() => goResults(byPostcode)} disabled={busy || !postcode.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Next"}
            </Button>
            <Button variant="outline" className="h-12 w-full" onClick={byGps} disabled={busy}>
              <MapPin className="size-4" /> Use where I am
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStep(0)}>Back</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <p className="text-lg font-semibold">Hosts near you</p>
              <button type="button" className="text-sm text-primary underline" onClick={() => { setHosts(null); setStep(1); }}>Change area</button>
            </div>
            {hosts && hosts.length > 0 && <CompatibilityNote state={compat} hostId={null} />}
            {hosts && hosts.length === 0 && publicNear === null && <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />}
            {hosts && hosts.length === 0 && publicNear && publicNear.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">No Lendawatt hosts in range yet, so here are public chargers you can reach.</p>
                {publicNear.map(({ c, miles: m }, i) => (
                  <a
                    key={c.id}
                    href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ animationDelay: `${i * 60}ms` }}
                    className="block animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-lg border border-border bg-card p-5 transition hover:border-primary"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{c.name}</span>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{m.toFixed(1)} mi</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[c.operator, c.maxKw ? `${c.maxKw} kW` : null, c.fee === "free" ? "Free" : null].filter(Boolean).join(" · ") || "Public charger"} · Tap for directions
                    </p>
                  </a>
                ))}
              </div>
            )}
            {hosts && hosts.length === 0 && publicNear && publicNear.length === 0 && (
              <div className="animate-in fade-in zoom-in-95 rounded-lg border border-border bg-card p-8 text-center">
                <div className="text-6xl" aria-hidden>😢</div>
                <p className="mt-3 text-lg font-semibold">We're really sorry</p>
                <p className="mt-1 text-sm text-muted-foreground">We couldn't find a Lendawatt host or a public charger within reach. Here's who can help right now.</p>
                <div className="mt-5 grid gap-2">
                  <Button asChild className="h-12"><a href="tel:999">Unsafe? Call 999</a></Button>
                  <Button asChild variant="outline" className="h-auto min-h-12 whitespace-normal"><a href="tel:03001235000">Motorway: National Highways 0300 123 5000</a></Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Many breakdown services can tow an EV to a charger, so call your breakdown cover too.</p>
              </div>
            )}
            {hosts?.map((h, i) => (
              <button
                key={h.host_id}
                type="button"
                onClick={() => { setPicked(h); setStep(3); }}
                style={{ animationDelay: `${i * 60}ms` }}
                className="w-full animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-lg border border-border bg-card p-5 text-left transition hover:border-primary"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{h.username}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{h.band}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <Tag>{CONNECTOR_LABEL[h.connector]}</Tag>
                  <Tag>{h.kw} kW</Tag>
                  <Tag>{h.cost === "free" ? "Free" : h.price_note || "Small fee"}</Tag>
                  {h.thumbs_up > 0 && <Tag>👍 {h.thumbs_up} helped</Tag>}
                </div>
              </button>
            ))}
            <Button variant="ghost" className="w-full" onClick={() => { setHosts(null); setStep(1); }}>Back</Button>
          </div>
        )}

        {step === 3 && picked && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-semibold">{picked.username}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{picked.band}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <Tag>{CONNECTOR_LABEL[picked.connector]}</Tag>
                <Tag>{picked.kw} kW</Tag>
                <Tag>{FITS_LABEL[picked.fits]}</Tag>
                <Tag>{picked.cost === "free" ? "Free" : picked.price_note || "Small fee"}</Tag>
                {picked.mode === "emergency" && <Tag>Emergencies only</Tag>}
              </div>
              {picked.notes && <p className="mt-2 text-sm text-muted-foreground">{picked.notes}</p>}
              <CompatibilityNote state={compat} hostId={picked.host_id} />
              <HostReviews hostId={picked.host_id} />
            </div>
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-6 text-sm">
              <p className="font-semibold">Being a good guest</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>Wait in your car while you charge, if you can.</li>
                <li>Only take what you need to get to your next charger or home.</li>
              </ul>
            </div>
            <Button className="h-12 w-full" onClick={() => setAsking(picked)}>Ask to charge</Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <Link to="/u/$username" params={{ username: picked.username }}>View profile</Link>
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => { setPicked(null); setStep(2); }}>Back to hosts</Button>
            </div>
          </div>
        )}
      </div>
      {asking && <AskForm host={asking} emergency={emergency} initialRange={milesLeft} onClose={() => setAsking(null)} onSent={() => { close(false); onSent(); }} />}
    </div>
    </DialogContent>
    </Dialog>
    </>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-0.5">{children}</span>;
}

function AskForm({ host, emergency, initialRange = "", onClose, onSent }: { host: NearbyHost; emergency: boolean; initialRange?: string; onClose: () => void; onSent: () => void }) {
  const qc = useQueryClient();
  const [car, setCar] = useState("");
  const [connector, setConnector] = useState("type2");
  const [range, setRange] = useState(initialRange);
  const [message, setMessage] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try {
      await requestCharge({ host: host.host_id, car, connector, range: range ? Number(range) : null, emergency, message });
      // Mirror the request into Messages so the host sees it in their normal inbox too (best effort).
      try {
        const { data: me } = await supabase.auth.getUser();
        if (me.user) {
          const convo = await fetchOrCreateConversation(me.user.id, host.host_id);
          await sendMessage(
            convo,
            me.user.id,
            `⚡ Lendawatt request${emergency ? " (emergency)" : ""}: could I use your charger?\nCar: ${car || "not given"}${range ? ` · ${range} miles left` : ""}${message ? `\n${message}` : ""}\n\nApprove or decline it in Lendawatt → Requests.`,
          );
        }
      } catch {
        /* the request itself was sent; the inbox copy is optional */
      }
      toast.success(`Request sent to ${host.username}`);
      qc.invalidateQueries({ queryKey: ["charge-requests"] });
      onClose();
      onSent();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-lg border-2 border-primary bg-card p-4">
      <h3 className="font-semibold">Ask {host.username}</h3>
      <div className="mt-2 space-y-2">
        <Input value={car} onChange={(e) => setCar(e.target.value)} placeholder="Your car, e.g. Kia Niro EV" maxLength={80} />
        <select value={connector} onChange={(e) => setConnector(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
          <option value="type2">My car takes Type 2</option>
          <option value="three_pin">I have a 3-pin cable</option>
          <option value="not_sure">Not sure</option>
        </select>
        <Input value={range} onChange={(e) => setRange(e.target.value.replace(/\D/g, ""))} placeholder="Miles of range left (optional)" inputMode="numeric" />
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} placeholder="Anything they should know — how long you need, the size of your car…" />
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
          I understand this is arranged between members. RevMate isn't responsible and doesn't handle payments.
        </label>
        <div className="flex gap-2">
          <Button onClick={send} disabled={busy || !agree || !car.trim()}>Send request</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

const BLANK = (userId: string): ChargerHost => ({
  user_id: userId, mode: "emergency", cost: "free", price_note: null, connector: "type2_socket",
  kw: 7, fits: "large", notes: null, district: "", lat: 0, lng: 0, discoverable: true, paused: false,
});

function HostSetup({ userId, onSettings }: { userId: string; onSettings: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-charger-host", userId], queryFn: () => fetchMyHost(userId) });
  const [form, setForm] = useState<ChargerHost | null>(null);
  const [postcode, setPostcode] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [joined, setJoined] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [editing, setEditing] = useState(false);
  if (isLoading) return <Loader2 className="mx-auto mt-6 size-5 animate-spin" />;
  if (thanks) return <ThankYou onPost={() => { setThanks(false); setJoined(true); }} onDone={() => setThanks(false)} />;
  if (joined) return <ShareStep userId={userId} onDone={() => setJoined(false)} />;
  const f = form ?? data ?? BLANK(userId);
  const set = (patch: Partial<ChargerHost>) => setForm({ ...f, ...patch });
  const wizard = !data;

  async function save() {
    setBusy(true);
    try {
      let next = f;
      if (postcode.trim() || !f.district) {
        const p = await lookupDistrict(postcode);
        next = { ...f, district: p.district, lat: p.lat, lng: p.lng };
      }
      await saveMyHost(next);
      setForm(null);
      setPostcode("");
      qc.invalidateQueries({ queryKey: ["my-charger-host", userId] });
      qc.invalidateQueries({ queryKey: ["badges", userId] });
      if (wizard) setThanks(true);
      else {
        setEditing(false);
        toast.success("Saved");
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm("Stop hosting and delete your charger details?")) return;
    await deleteMyHost(userId);
    setForm(null);
    setStep(0);
    qc.invalidateQueries({ queryKey: ["my-charger-host", userId] });
    toast.success("Removed. Your charger details are deleted.");
  }

  const select = "h-9 w-full rounded-md border bg-background px-2 text-sm";
  const intro = (
    <div className="space-y-3">
      <span className="mx-auto flex size-24 items-center justify-center rounded-2xl bg-foreground text-background"><CommunityChargerLogo className="size-full" /></span>
      <h2 className="text-center text-lg font-bold">Become a Community Charger</h2>
      <ul className="space-y-2 text-muted-foreground">
        <li>⚡ Help a stranded EV driver with your home charger, for free or for a small fee.</li>
        <li>🔒 Nobody sees where you live. Drivers only see a rough distance until you approve them.</li>
        <li>✋ You say yes or no to every request, and you can pause any time.</li>
      </ul>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
        I'm 18 or over, it's my charger to share, and I understand any arrangement is between me and the driver. RevMate isn't responsible and doesn't handle money.
      </label>
    </div>
  );
  const charger = (
    <div className="space-y-3">
      <Field label="What charger do you have?">
        <select className={select} value={f.connector} onChange={(e) => set({ connector: e.target.value as ChargerHost["connector"] })}>
          <option value="type2_socket">Type 2 socket (driver brings a cable)</option>
          <option value="type2_tethered">Tethered Type 2 cable</option>
          <option value="three_pin">3-pin outdoor plug only</option>
        </select>
      </Field>
      <Field label="Speed">
        <select className={select} value={f.kw} onChange={(e) => set({ kw: Number(e.target.value) })}>
          {[2.3, 3.6, 7, 11, 22].map((k) => <option key={k} value={k}>{k} kW</option>)}
        </select>
      </Field>
      <Field label="Driveway">
        <select className={select} value={f.fits} onChange={(e) => set({ fits: e.target.value as ChargerHost["fits"] })}>
          {Object.entries(FITS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
    </div>
  );
  const terms = (
    <div className="space-y-3">
      <Field label="Who can ask">
        <select className={select} value={f.mode} onChange={(e) => set({ mode: e.target.value as ChargerHost["mode"] })}>
          <option value="emergency">Emergencies only</option>
          <option value="any">Emergencies and planned visits</option>
        </select>
      </Field>
      <Field label="Cost">
        <select className={select} value={f.cost} onChange={(e) => set({ cost: e.target.value as ChargerHost["cost"] })}>
          <option value="free">Free — happy to help</option>
          <option value="paid">I'd like something towards the electricity</option>
        </select>
        {f.cost === "paid" && (
          <Input className="mt-2" maxLength={80} value={f.price_note ?? ""} onChange={(e) => set({ price_note: e.target.value })} placeholder="e.g. £10 cash or 30p per kWh" />
        )}
        <p className="mt-1 text-xs text-muted-foreground">You sort any payment out with the driver. RevMate never takes a cut.</p>
      </Field>
      <Field label="Notes (optional)">
        <Textarea maxLength={300} value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. Message first, usually home evenings" />
      </Field>
    </div>
  );
  const area = (
    <div className="space-y-3">
      <Field label={f.district ? `Your area: ${f.district} (enter a postcode to change it)` : "Your postcode"}>
        <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Only the area is kept, e.g. LS6" />
        <p className="mt-1 text-xs text-muted-foreground">We keep the first half of your postcode and a point rounded to about 1 km. Drivers only see a distance like "2–5 mi".</p>
      </Field>
      <label className="flex items-center justify-between gap-3 font-medium">
        Show me to drivers searching nearby
        <Switch checked={f.discoverable} onCheckedChange={(v) => set({ discoverable: v })} />
      </label>
      <p className="-mt-2 text-xs text-muted-foreground">Turn this off to only appear when someone is in an emergency.</p>
    </div>
  );

  if (wizard) {
    const steps = [intro, charger, terms, area];
    const titles = ["Welcome", "Your charger", "Your terms", "Your area"];
    const last = step === steps.length - 1;
    const canNext = step === 0 ? agree : last ? !!postcode.trim() : true;
    return (
      <div className="space-y-6 text-sm">
        <div className="mb-3 flex items-center gap-1.5">
          {titles.map((t, i) => (
            <div key={t} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Step {step + 1} of {steps.length} · {titles[step]}
        </p>
        {steps[step]}
        <div className="mt-4 flex gap-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
          <Button className="flex-1" disabled={busy || !canNext} onClick={() => (last ? save() : setStep(step + 1))}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {last ? "Become a Community Charger" : "Next"}
          </Button>
        </div>
      </div>
    );
  }

  if (!editing)
    return (
      <div className="space-y-6 text-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-foreground text-background"><CommunityChargerLogo className="size-full" /></span>
          <div>
            <p className="font-bold">You're a Community Charger ⚡</p>
            <p className="text-xs text-muted-foreground">{f.paused ? "Paused — nobody can find you" : "Hosting is on"} · Area {f.district}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Info label="Charger" value={CONNECTOR_LABEL[f.connector] ?? ""} />
          <Info label="Speed" value={`${f.kw} kW`} />
          <Info label="Driveway" value={FITS_LABEL[f.fits] ?? ""} />
          <Info label="Cost" value={f.cost === "free" ? "Free" : f.price_note || "Small fee"} />
          <Info label="Who can ask" value={f.mode === "any" ? "Emergencies and planned visits" : "Emergencies only"} />
          <Info label="Nearby searches" value={f.discoverable ? "Shown" : "Emergencies only"} />
        </div>
        <p className="text-xs text-muted-foreground">Drivers only see a rough distance. Your address is only shared with a driver you approve, and it's removed after 4 hours.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSettings}>Settings</Button>
          <Button variant="outline" onClick={() => setEditing(true)}>Edit details</Button>
          <Button variant="outline" onClick={() => setJoined(true)}>Post about it</Button>
          <Button variant="ghost" className="text-destructive" onClick={remove}>Opt out</Button>
        </div>
      </div>
    );

  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-xl bg-foreground text-background"><CommunityChargerLogo className="size-full" /></span>
        <div>
          <p className="font-bold">Edit your charger</p>
          <p className="text-xs text-muted-foreground">Area {f.district} · {f.cost === "free" ? "Free" : f.price_note || "Small fee"}</p>
        </div>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-md bg-muted p-3 font-medium">
        {f.paused ? "Paused — nobody can find you" : "Hosting is on"}
        <Switch checked={!f.paused} onCheckedChange={(v) => set({ paused: !v })} />
      </label>
      {charger}
      {terms}
      {area}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} Save changes
        </Button>
        <Button variant="ghost" onClick={() => { setForm(null); setEditing(false); }}>Cancel</Button>
      </div>
    </div>
  );
}

const DEFAULT_POST =
  "⚡ I've joined RevMate's Community Chargers! If you're an EV driver who's stuck with low range near me, you can ask to use my home charger in an emergency. Nobody sees where I live unless I say yes. Fancy joining? Find it under EV chargers → Community chargers. #CommunityCharger #EV";

function ShareStep({ userId, onDone }: { userId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState(DEFAULT_POST);
  const [withLogo, setWithLogo] = useState(true);
  const [busy, setBusy] = useState(false);
  async function post() {
    setBusy(true);
    try {
      const id = await createPost({ userId, body: body.trim() });
      if (withLogo) {
        const blob = await (await fetch("/community-charger-logo.jpg")).blob();
        const url = await uploadImageBlob("post-images", userId, blob);
        await attachImagesToPost(id, [url]);
      }
      qc.invalidateQueries();
      toast.success("Posted to the feed");
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5 text-sm">
      <p className="text-center text-3xl">⚡</p>
      <h2 className="text-center text-lg font-bold">You've earned the Community Charger badge</h2>
      <p className="text-center text-muted-foreground">Want to tell people? It helps the network grow. This is optional, so skip it if you'd rather keep it quiet.</p>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={2000} />
      <label className="flex items-center justify-between gap-3 font-medium">
        Add the Community Charger logo
        <Switch checked={withLogo} onCheckedChange={setWithLogo} />
      </label>
      {withLogo && <img src="/community-charger-logo.jpg" alt="Community Charger logo" width={1088} height={1088} className="mx-auto w-40 rounded-xl" />}
      <div className="flex gap-2">
        <Button className="flex-1" disabled={busy || !body.trim()} onClick={post}>
          {busy && <Loader2 className="size-4 animate-spin" />} Post to the feed
        </Button>
        <Button variant="ghost" onClick={onDone}>No thanks</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-medium">{label}</p>
      {children}
    </div>
  );
}

const STATUS: Record<string, string> = {
  pending: "Waiting for a reply", approved: "Approved", declined: "Declined",
  done: "Finished", expired: "Expired", cancelled: "Cancelled",
};

function Requests() {
  const { data = [], isLoading } = useQuery({ queryKey: ["charge-requests"], queryFn: fetchMyRequests, refetchInterval: 30_000 });
  if (isLoading) return <Loader2 className="mx-auto mt-6 size-5 animate-spin" />;
  if (!data.length) return <p className="py-6 text-center text-sm text-muted-foreground">No requests yet.</p>;
  return <div className="mt-4 space-y-3">{data.map((r) => <RequestCard key={r.id} r={r} />)}</div>;
}

function RequestCard({ r }: { r: ChargeRequest }) {
  const qc = useQueryClient();
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ["charge-requests"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  const handle = r.other_username.replace(/^@/, "");
  return (
    <div className="border-t border-border pt-5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">
          {r.role === "host" ? `${r.other_username} asked to charge` : `You asked ${r.other_username}`}
        </span>
        <span className="flex items-center gap-1 text-xs">
          {r.emergency && <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">Emergency</span>}
          <span className="rounded-full bg-muted px-2 py-0.5">{STATUS[r.status] ?? r.status}</span>
        </span>
      </div>
      <p className="mt-1 text-muted-foreground">
        <Zap className="mr-1 inline size-3.5" />{r.car} · {CONNECTOR_LABEL[r.connector]}{r.range_miles != null ? ` · ${r.range_miles} mi left` : ""}
      </p>
      {r.message && <p className="mt-1">{r.message}</p>}
      {r.role === "driver" && (r.status === "done" || r.status === "expired") && r.expires_at && r.rating == null && (
        <ReviewForm id={r.id} name={r.other_username} />
      )}

      {r.shared_location && (
        <div className="mt-2 rounded-md bg-primary/10 p-2">
          <p className="font-semibold"><MapPin className="mr-1 inline size-4" />{r.role === "host" ? "You shared" : "Meet here"}: {r.shared_location}</p>
          {r.role === "driver" && r.status === "approved" && (
            <div className="my-2 flex flex-wrap gap-2">
              {[
                ["Google Maps", `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.shared_location)}`],
                ["Apple Maps", `https://maps.apple.com/?daddr=${encodeURIComponent(r.shared_location)}`],
                ["Waze", `https://waze.com/ul?q=${encodeURIComponent(r.shared_location)}&navigate=yes`],
              ].map(([label, href]) => (
                <Button key={label} size="sm" asChild>
                  <a href={href} target="_blank" rel="noopener noreferrer"><MapPin className="size-4" /> {label}</a>
                </Button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Only you two can see this. It disappears {r.expires_at ? new Date(r.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "soon"}.</p>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link to="/u/$username" params={{ username: r.other_username }}>View profile</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/messages/$username" params={{ username: handle }}>Message</Link>
        </Button>
        {r.role === "host" && r.status === "pending" && (
          <>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={300} placeholder="Where to come — address, what3words…" className="basis-full" />
            <Button size="sm" disabled={busy || location.trim().length < 3} onClick={() => act(() => respondToRequest(r.id, "approve", location), "Approved — only they can see the location")}>
              Approve and share location
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => respondToRequest(r.id, "decline"), "Declined")}>Can't help</Button>
          </>
        )}
        {r.role === "driver" && r.status === "pending" && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => respondToRequest(r.id, "cancel"), "Cancelled")}>Cancel</Button>
        )}
        {r.status === "approved" && (
          <Button size="sm" disabled={busy} onClick={() => act(() => respondToRequest(r.id, "done"), "Marked as done — location removed")}>All done</Button>
        )}
      </div>
    </div>
  );
}

function NetworkStats() {
  const { data } = useQuery({ queryKey: ["community-charger-stats"], queryFn: fetchCommunityStats, staleTime: 60_000 });
  if (!data) return null;
  const items: [number, string][] = [
    [data.hosts, data.hosts === 1 ? "Community Charger" : "Community Chargers"],
    [data.ev_drivers, "EV drivers on RevMate"],
    [data.helped, data.helped === 1 ? "driver helped" : "drivers helped"],
  ];
  return (
    <div className="relative mt-8 grid grid-cols-3 divide-x divide-border text-center">
      {items.map(([n, label]) => (
        <div key={label} className="px-2">
          <p className="text-2xl font-extrabold text-primary">{n}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

function SettingsPanel({ userId, onHost }: { userId: string; onHost: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-charger-host", userId], queryFn: () => fetchMyHost(userId) });
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Loader2 className="mx-auto mt-6 size-5 animate-spin" />;
  async function update(patch: Partial<ChargerHost>) {
    if (!data) return;
    setBusy(true);
    try {
      await saveMyHost({ ...data, ...patch });
      qc.invalidateQueries({ queryKey: ["my-charger-host", userId] });
      toast.success("Saved");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    if (!confirm("Leave Community Chargers? Your charger details and area will be deleted.")) return;
    setBusy(true);
    try {
      await deleteMyHost(userId);
      qc.invalidateQueries({ queryKey: ["my-charger-host", userId] });
      qc.invalidateQueries({ queryKey: ["community-charger-stats"] });
      toast.success("You've left. Your charger details are deleted.");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-xl bg-foreground text-background"><CommunityChargerLogo className="size-full" /></span>
        <div>
          <p className="font-bold">Your Community Charger settings</p>
          <p className="text-xs text-muted-foreground">You're in control. Change or leave any time.</p>
        </div>
      </div>
      <div className="rounded-md bg-muted p-3">
        <p className="font-semibold">Your location</p>
        <p className="mt-1 text-muted-foreground">
          Joining never shows where you live. Drivers only see a rough distance like "2–5 mi". Your address is only shared when you approve a request and type it in, and only that driver sees it. It's removed after 4 hours or when you tap All done.
        </p>
        {data && <p className="mt-1 text-xs text-muted-foreground">Saved area: {data.district} (rounded to about 1 km)</p>}
      </div>
      {data ? (
        <>
          <label className="flex items-center justify-between gap-3 font-medium">
            Hosting is on
            <Switch checked={!data.paused} disabled={busy} onCheckedChange={(v) => update({ paused: !v })} />
          </label>
          <label className="flex items-center justify-between gap-3 font-medium">
            Show me to drivers searching nearby
            <Switch checked={data.discoverable} disabled={busy} onCheckedChange={(v) => update({ discoverable: v })} />
          </label>
          <p className="-mt-2 text-xs text-muted-foreground">Off means you only appear for emergencies.</p>
          <label className="flex items-center justify-between gap-3 font-medium">
            Planned visits as well as emergencies
            <Switch checked={data.mode === "any"} disabled={busy} onCheckedChange={(v) => update({ mode: v ? "any" : "emergency" })} />
          </label>
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button variant="outline" onClick={onHost}>Edit charger, price or area</Button>
            <Button variant="ghost" className="text-destructive" disabled={busy} onClick={leave}>Opt out of Community Chargers</Button>
          </div>
        </>
      ) : (
        <div>
          <p className="text-muted-foreground">You're not hosting. You can still ask members for a charge.</p>
          <Button className="mt-2" onClick={onHost}>Offer my charger</Button>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function ThankYou({ onPost, onDone }: { onPost: () => void; onDone: () => void }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-primary/40 bg-card p-6 text-center text-foreground">
      <div className="relative mx-auto flex size-28 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-primary" style={{ animation: "cc-ring 1.6s ease-out infinite" }} />
        <span className="absolute inset-0 rounded-full border-2 border-primary" style={{ animation: "cc-ring 1.6s ease-out 0.8s infinite" }} />
        <span className="flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground" style={{ animation: "cc-pop 0.7s ease-out both" }}>
          <CommunityChargerLogo className="size-full rounded-full" />
        </span>
      </div>
      <h2 className="mt-5 text-2xl font-extrabold" style={{ animation: "cc-pop 0.7s ease-out 0.2s both" }}>Thank you! ⚡</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        You're now a Community Charger and you've earned the badge. You've just made the road a little less lonely for EV drivers near you.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={onDone}>Done</Button>
        <Button variant="ghost" onClick={onPost}>Tell people on the feed</Button>
      </div>
    </div>
  );
}

function HostReviews({ hostId }: { hostId: string }) {
  const [open, setOpen] = useState(false);
  const { data = [], isLoading } = useQuery({ queryKey: ["host-reviews", hostId], queryFn: () => fetchHostReviews(hostId), enabled: open });
  if (!open) return <button className="mt-2 text-xs font-semibold text-primary" onClick={() => setOpen(true)}>Read reviews</button>;
  if (isLoading) return <Loader2 className="mt-2 size-4 animate-spin text-muted-foreground" />;
  if (!data.length) return <p className="mt-2 text-xs text-muted-foreground">No reviews yet.</p>;
  return (
    <div className="mt-2 space-y-1.5">
      {data.map((v) => (
        <div key={v.id} className="rounded-md bg-muted p-2 text-xs">
          <p className="font-semibold">{v.rating > 0 ? "👍" : "👎"} {v.reviewer_username}</p>
          {v.review && <p className="mt-0.5 text-muted-foreground">{v.review}</p>}
        </div>
      ))}
    </div>
  );
}

function ReviewForm({ id, name }: { id: string; name: string }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!rating) return;
    setBusy(true);
    try {
      await leaveHostReview(id, rating, text);
      toast.success("Thanks — your review helps others trust the network");
      qc.invalidateQueries({ queryKey: ["charge-requests"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 space-y-2 rounded-md border p-2">
      <p className="text-xs font-semibold">How was charging with {name}?</p>
      <div className="flex gap-2">
        <Button size="sm" variant={rating === 1 ? "default" : "outline"} onClick={() => setRating(1)}><ThumbsUp className="size-4" /> Great</Button>
        <Button size="sm" variant={rating === -1 ? "default" : "outline"} onClick={() => setRating(-1)}><ThumbsDown className="size-4" /> Not good</Button>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={2} placeholder="Say a few words for other drivers (optional)" />
      <Button size="sm" disabled={busy || !rating} onClick={send}>Post review</Button>
    </div>
  );
}
