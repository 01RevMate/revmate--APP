import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  HeartHandshake,
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
import {
  CONNECTOR_LABEL,
  FITS_LABEL,
  deleteMyHost,
  fetchMyHost,
  fetchMyRequests,
  findNearbyHosts,
  rateHost,
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
  component: CommunityChargersPage,
});

const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Something went wrong");

function CommunityChargersPage() {
  const { user } = useAuth();
  const { open: openAuth } = useAuthModal();
  const [tab, setTab] = useState<"need" | "host" | "requests">("need");

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 pb-24">
      <Link to="/ev-chargers" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> EV chargers
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
        <HeartHandshake className="size-6 text-primary" /> Community chargers
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Stuck with low range and no public charger close by? Members can offer their home charger in an
        emergency, for free or for a small fee. Nobody sees where a host lives unless the host says yes.
      </p>

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
          <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-sm">
            {([
              ["need", "I need a charge"],
              ["host", "Offer my charger"],
              ["requests", "Requests"],
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
          {tab === "host" && <HostSetup userId={user.id} />}
          {tab === "requests" && <Requests />}
        </>
      )}

      <section className="mt-6 rounded-lg border bg-card p-4 text-sm">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4" /> The small print, in plain words</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Any arrangement is between members. RevMate doesn't check chargers or homes, and it isn't part of any deal.</li>
          <li>RevMate never takes or handles money. If a host charges, you agree it with them directly.</li>
          <li>Hosts are responsible for their own charger and cable. Drivers should use their own cable where they can.</li>
          <li>If you're in danger, call 999. For a breakdown, call your breakdown cover first.</li>
          <li>Safety: tell a friend where you're going, arrive in daylight if you can, and leave if anything feels wrong. Report or block anyone from their profile.</li>
          <li>Hosts' location is kept to about 1 km. An exact meeting place is only shown to the driver the host approves, and it's deleted after 4 hours.</li>
        </ul>
      </section>
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
          <Button size="sm" className="mt-2" onClick={() => setAsking(h)}>Ask to charge</Button>
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

function HostSetup({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-charger-host", userId], queryFn: () => fetchMyHost(userId) });
  const [form, setForm] = useState<ChargerHost | null>(null);
  const [postcode, setPostcode] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  if (isLoading) return <Loader2 className="mx-auto mt-6 size-5 animate-spin" />;
  const f = form ?? data ?? BLANK(userId);
  const set = (patch: Partial<ChargerHost>) => setForm({ ...f, ...patch });

  async function save() {
    setBusy(true);
    try {
      let next = f;
      if (postcode.trim() || !f.district) {
        const p = await lookupDistrict(postcode);
        next = { ...f, district: p.district, lat: p.lat, lng: p.lng };
      }
      await saveMyHost(next);
      toast.success(data ? "Saved" : "You're now a community charger host — thank you!");
      setForm(null);
      setPostcode("");
      qc.invalidateQueries({ queryKey: ["my-charger-host", userId] });
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
    qc.invalidateQueries({ queryKey: ["my-charger-host", userId] });
    toast.success("Removed. Your charger details are deleted.");
  }

  const select = "h-9 w-full rounded-md border bg-background px-2 text-sm";
  return (
    <div className="mt-4 space-y-3 rounded-lg border bg-card p-4 text-sm">
      {data && (
        <label className="flex items-center justify-between gap-3 rounded-md bg-muted p-3 font-medium">
          {f.paused ? "Paused — nobody can find you" : "Hosting is on"}
          <Switch checked={!f.paused} onCheckedChange={(v) => set({ paused: !v })} />
        </label>
      )}
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
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Charger">
          <select className={select} value={f.connector} onChange={(e) => set({ connector: e.target.value as ChargerHost["connector"] })}>
            <option value="type2_socket">Type 2 socket</option>
            <option value="type2_tethered">Tethered cable</option>
            <option value="three_pin">3-pin plug only</option>
          </select>
        </Field>
        <Field label="Speed">
          <select className={select} value={f.kw} onChange={(e) => set({ kw: Number(e.target.value) })}>
            {[2.3, 3.6, 7, 11, 22].map((k) => <option key={k} value={k}>{k} kW</option>)}
          </select>
        </Field>
      </div>
      <Field label="Driveway">
        <select className={select} value={f.fits} onChange={(e) => set({ fits: e.target.value as ChargerHost["fits"] })}>
          {Object.entries(FITS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="Notes (optional)">
        <Textarea maxLength={300} value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. Message first, usually home evenings" />
      </Field>
      <Field label={f.district ? `Your area: ${f.district} (change by entering a postcode)` : "Your postcode"}>
        <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Only the area is kept, e.g. LS6" />
        <p className="mt-1 text-xs text-muted-foreground">We keep the first half of your postcode and a point rounded to about 1 km. Drivers only see a distance like "2–5 mi".</p>
      </Field>
      <label className="flex items-center justify-between gap-3 font-medium">
        Show me to drivers searching nearby
        <Switch checked={f.discoverable} onCheckedChange={(v) => set({ discoverable: v })} />
      </label>
      <p className="-mt-2 text-xs text-muted-foreground">Turn off to only appear when someone is in an emergency.</p>
      {!data && (
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
          I'm 18 or over, it's my charger to share, and I understand any arrangement is between me and the driver. RevMate isn't responsible and doesn't handle money.
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy || (!data && !agree) || (!f.district && !postcode.trim())}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {data ? "Save changes" : "Offer my charger"}
        </Button>
        {data && <Button variant="ghost" onClick={remove}>Stop hosting and delete</Button>}
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

      {r.shared_location && (
        <div className="mt-2 rounded-md bg-primary/10 p-2">
          <p className="font-semibold"><MapPin className="mr-1 inline size-4" />{r.role === "host" ? "You shared" : "Meet here"}: {r.shared_location}</p>
          <p className="text-xs text-muted-foreground">Only you two can see this. It disappears {r.expires_at ? new Date(r.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "soon"}.</p>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
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
        {r.role === "driver" && (r.status === "done" || r.status === "expired") && r.expires_at && r.rating == null && (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => rateHost(r.id, 1), "Thanks for the feedback")}><ThumbsUp className="size-4" /> Helped</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => rateHost(r.id, -1), "Thanks for the feedback")}><ThumbsDown className="size-4" /></Button>
          </>
        )}
      </div>
    </div>
  );
}
