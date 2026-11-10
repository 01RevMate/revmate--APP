import { useEffect, useState } from "react";
import { CommunityChargerMark } from "@/components/CommunityChargerMark";
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
const TITLE = "Community home EV chargers — help when you're stranded | RevMate";
const DESC =
  "Low on range with no public charger nearby? RevMate members can offer their home charger in an emergency, free or for a small fee. Private, opt-in and arranged between drivers.";

export const Route = createFileRoute("/ev-chargers_/community")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: "Stranded EV? Borrow a member's home charger | RevMate" },
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
  useEffect(() => { if (search.tab) setTab(search.tab); }, [search.tab]);

  return (
    <div className="charge-theme min-h-screen">
    <div className="mx-auto max-w-2xl px-3 py-4 pb-24">
      <Link to="/ev-chargers" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> EV chargers
      </Link>
      <header className="relative mt-2 overflow-hidden rounded-3xl border border-primary/40 bg-card p-5 text-foreground">
        <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-primary/30 blur-3xl" />
        <div className="relative mb-4 flex items-center gap-2">
          <img src="/brand/revmate-logo-dark.png" alt="RevMate" className="h-7 w-auto object-contain" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Community Charger</span>
        </div>
        <div className="relative flex items-center gap-4">
          <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
            <CommunityChargerMark className="size-12" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold leading-tight">Community chargers</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              EV drivers helping each other. Low on range with no public charger nearby? Members lend their home charger in an emergency. Nobody sees where a host lives unless the host says yes.
            </p>
          </div>
        </div>
        <NetworkStats />
      </header>

      <StrandedPanel />

      {!user ? (
        <div className="mt-4 rounded-lg border bg-card p-4">
          <p className="text-sm">Sign in to find a member's charger or offer yours. It's for members aged 18 and over.</p>
          <Button className="mt-3" onClick={() => openAuth("Create a free account to join the community charger network.")}>
            Sign in or join
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-4 gap-1 rounded-lg bg-muted p-1 text-sm">
            {([
              ["need", "Find a charge"],
              ["host", "My charger"],
              ["requests", "Requests"],
              ["settings", "Settings"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-md px-2 py-2 font-medium ${tab === k ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "need" && <NeedCharge onSent={() => setTab("requests")} />}
          {tab === "host" && <HostSetup userId={user.id} onSettings={() => setTab("settings")} />}
          {tab === "requests" && <Requests />}
          {tab === "settings" && <SettingsPanel userId={user.id} onHost={() => setTab("host")} />}
        </>
      )}

      <section className="mt-6 rounded-lg border bg-card p-4 text-sm">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4" /> The small print, in plain words</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Any arrangement is between members. RevMate doesn't check chargers or homes, and it isn't part of any deal.</li>
          <li>RevMate never takes or handles money. If a host charges, you agree it with them directly.</li>
          <li>Hosts are responsible for their own charger and cable. Drivers should use their own cable where they can.</li>
          <li>If you're in danger, call 999. For a breakdown, call your breakdown cover first.</li>
          <li>Hosts can see the profile of anyone who asks, and drivers can see the host's profile, so you know who you're meeting.</li>
          <li>Everything is arranged inside RevMate. Phone numbers are never shared.</li>
          <li>Hosts' location is kept to about 1 km. An exact meeting place is only shown to the driver the host approves, and it's deleted after 4 hours.</li>
        </ul>
      </section>
    </div>
    </div>
  );
}

function StrandedPanel() {
  return (
    <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold"><Phone className="size-4" /> Stranded right now?</p>
      <p className="mt-1 text-muted-foreground">
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
  const [busy, setBusy] = useState(false);
  const [hosts, setHosts] = useState<NearbyHost[] | null>(null);
  const [asking, setAsking] = useState<NearbyHost | null>(null);

  async function search(lat: number, lng: number) {
    setHosts(await findNearbyHosts(lat, lng, emergency));
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

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-lg border bg-card p-4">
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          It's an emergency (I can't reach a public charger)
          <Switch checked={emergency} onCheckedChange={setEmergency} />
        </label>
        <div className="mt-3 flex gap-2">
          <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode or area, e.g. LS6" />
          <Button onClick={byPostcode} disabled={busy || !postcode.trim()}>Search</Button>
        </div>
        <Button variant="outline" className="mt-2 w-full" onClick={byGps} disabled={busy}>
          <MapPin className="size-4" /> Use where I am
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">Your location is rounded to about 1 km, used for this search only and not saved.</p>
      </div>

      {busy && <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />}
      {hosts && hosts.length === 0 && (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          No community hosts within 30 miles yet. Try the public charger map, and ask EV owners you know to sign up as hosts.
        </p>
      )}
      {hosts?.map((h) => (
        <div key={h.host_id} className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{h.username}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{h.band}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            <Tag>{CONNECTOR_LABEL[h.connector]}</Tag>
            <Tag>{h.kw} kW</Tag>
            <Tag>{FITS_LABEL[h.fits]}</Tag>
            <Tag>{h.cost === "free" ? "Free" : h.price_note || "Small fee"}</Tag>
            {h.mode === "emergency" && <Tag>Emergencies only</Tag>}
            {h.thumbs_up > 0 && <Tag>👍 {h.thumbs_up} helped</Tag>}
          </div>
          {h.notes && <p className="mt-1 text-sm text-muted-foreground">{h.notes}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setAsking(h)}>Ask to charge</Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/u/$username" params={{ username: h.username }}>View profile</Link>
            </Button>
          </div>
          <HostReviews hostId={h.host_id} />
        </div>
      ))}
      {asking && <AskForm host={asking} emergency={emergency} onClose={() => setAsking(null)} onSent={onSent} />}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-0.5">{children}</span>;
}

function AskForm({ host, emergency, onClose, onSent }: { host: NearbyHost; emergency: boolean; onClose: () => void; onSent: () => void }) {
  const qc = useQueryClient();
  const [car, setCar] = useState("");
  const [connector, setConnector] = useState("type2");
  const [range, setRange] = useState("");
  const [message, setMessage] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try {
      await requestCharge({ host: host.host_id, car, connector, range: range ? Number(range) : null, emergency, message });
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
      <span className="mx-auto flex size-24 items-center justify-center rounded-2xl bg-foreground text-background"><CommunityChargerMark className="size-14" /></span>
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
      <div className="mt-4 rounded-2xl border bg-card p-4 text-sm">
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
      <div className="mt-4 space-y-4 rounded-2xl border bg-card p-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-foreground text-background"><CommunityChargerMark className="size-7" /></span>
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
    <div className="mt-4 space-y-4 rounded-2xl border bg-card p-4 text-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-xl bg-foreground text-background"><CommunityChargerMark className="size-7" /></span>
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
    <div className="mt-4 space-y-3 rounded-2xl border bg-card p-4 text-sm">
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
  if (!data.length) return <p className="mt-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground">No requests yet.</p>;
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
    <div className="rounded-lg border bg-card p-3 text-sm">
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
    <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
      {items.map(([n, label]) => (
        <div key={label} className="rounded-xl bg-primary/10 px-2 py-2">
          <p className="text-xl font-extrabold">{n}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
        </div>
      ))}
      {data.hosts < 25 && <p className="col-span-3 text-xs text-muted-foreground">The network is just starting — early hosts get the Community Charger badge.</p>}
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
    <div className="mt-4 space-y-4 rounded-2xl border bg-card p-4 text-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-xl bg-foreground text-background"><CommunityChargerMark className="size-7" /></span>
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
          <CommunityChargerMark className="size-14" />
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
