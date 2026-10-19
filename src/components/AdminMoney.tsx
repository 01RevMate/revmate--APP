import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchChallenges } from "@/lib/engagement";
import {
  DEAL_PLACEMENTS,
  deleteDeal,
  fetchAllDeals,
  fetchMoneyStats,
  fetchProducts,
  fetchRecentPayments,
  formatPence,
  saveDeal,
  saveSetting,
  saveSponsorship,
  updateProduct,
  useMoneySettings,
  type Deal,
  type DealInput,
  type PaidProduct,
} from "@/lib/money";
import { displayUsernameWithoutAt } from "@/lib/usernames";

// Admin → Money. Everything to do with earning lives here, away from the
// social side of the app.

type Tab = "overview" | "prices" | "deals" | "sponsors" | "shop" | "payments";

const TABS: [Tab, string][] = [
  ["overview", "Overview"],
  ["prices", "Prices"],
  ["deals", "Deals"],
  ["sponsors", "Sponsors"],
  ["shop", "Shop"],
  ["payments", "Payments"],
];

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function AdminMoney() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">Money</h2>
      <p className="text-sm text-muted-foreground">
        Paid extras, deals and sponsors. None of this ever shows in the social feed.
      </p>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
              tab === id
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "overview" && <Overview />}
        {tab === "prices" && <Prices />}
        {tab === "deals" && <Deals />}
        {tab === "sponsors" && <Sponsors />}
        {tab === "shop" && <Shop />}
        {tab === "payments" && <Payments />}
      </div>
    </section>
  );
}

// ---------- Overview ----------

function Overview() {
  const queryClient = useQueryClient();
  const settings = useMoneySettings();
  const stats = useQuery({ queryKey: ["admin", "money-stats"], queryFn: fetchMoneyStats });
  const [saving, setSaving] = useState(false);
  const s = stats.data;

  async function togglePayments() {
    if (!settings) return;
    const next = !settings.payments_enabled;
    if (
      next &&
      !window.confirm(
        "Switch payments on? Only do this once Stripe and the three payment functions are set up (see the checklist below).",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await saveSetting("payments_enabled", next ? "true" : "false");
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success(next ? "Payments are on" : "Payments are off");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  const tiles: [string, string][] = s
    ? [
        ["This month", formatPence(s.revenue_month_pence)],
        ["Last 30 days", formatPence(s.revenue_30d_pence)],
        ["All time", formatPence(s.revenue_all_pence)],
        ["Plus members", String(s.plus_members)],
        ["Business Pro", String(s.business_pro)],
        ["Featured adverts now", String(s.featured_now)],
        ["Deal clicks", String(s.deal_clicks)],
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
        <div>
          <p className="font-semibold">Payments are {settings?.payments_enabled ? "on" : "off"}</p>
          <p className="text-sm text-muted-foreground">
            {settings?.payments_enabled
              ? "Members can feature adverts, join Plus and go Business Pro."
              : "Nothing is for sale. Deals and the shop link still work."}
          </p>
        </div>
        <button
          type="button"
          onClick={togglePayments}
          disabled={saving || !settings}
          className={`min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-60 ${
            settings?.payments_enabled
              ? "border border-input"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {settings?.payments_enabled ? "Switch off" : "Switch on"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-3">
            <p className="text-2xl font-extrabold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      {stats.error && <p className="text-sm text-destructive">{(stats.error as Error).message}</p>}

      <div className="rounded-xl bg-muted/60 p-4 text-sm">
        <p className="font-semibold">Before switching payments on</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Create a Stripe account (stripe.com) and finish its business checks.</li>
          <li>
            Add the edge function secret <code>STRIPE_SECRET_KEY</code> and deploy create-checkout,
            stripe-webhook and billing-portal (Lovable can do this).
          </li>
          <li>
            In Stripe, add a webhook pointing at the stripe-webhook function and save its signing
            secret as <code>STRIPE_WEBHOOK_SECRET</code>.
          </li>
          <li>In Stripe, save the Customer portal settings once.</li>
          <li>Try a test payment in Stripe test mode, then switch to live keys.</li>
        </ol>
      </div>
    </div>
  );
}

// ---------- Prices ----------

function Prices() {
  const queryClient = useQueryClient();
  const { data: products } = useQuery({ queryKey: ["admin", "products"], queryFn: fetchProducts });
  return (
    <ul className="space-y-3">
      {products?.map((p) => (
        <PriceRow
          key={p.code}
          product={p}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
            void queryClient.invalidateQueries({ queryKey: ["paid-products"] });
          }}
        />
      ))}
    </ul>
  );
}

const poundsToPence = (v: string) => Math.round(Number(v) * 100);

function PriceRow({ product, onSaved }: { product: PaidProduct; onSaved: () => void }) {
  const [price, setPrice] = useState((product.price_pence / 100).toFixed(2));
  const [founding, setFounding] = useState(
    product.founding_price_pence ? (product.founding_price_pence / 100).toFixed(2) : "",
  );
  const [active, setActive] = useState(product.active);
  const [saving, setSaving] = useState(false);

  async function save() {
    const pence = poundsToPence(price);
    const foundingPence = founding.trim() ? poundsToPence(founding) : null;
    if (!(pence >= 50) || (foundingPence !== null && !(foundingPence >= 50))) {
      toast.error("Prices must be at least £0.50");
      return;
    }
    setSaving(true);
    try {
      await updateProduct(product.code, {
        price_pence: pence,
        founding_price_pence: foundingPence,
        active,
      });
      toast.success(`${product.name} saved`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            {product.billing === "monthly" ? "Monthly" : "One-off"} · {product.description}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          For sale
        </label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">
          Price (£)
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            className={input}
          />
        </label>
        {product.kind === "plus" && (
          <label className="text-xs text-muted-foreground">
            Founding member price (£, blank = none)
            <input
              value={founding}
              onChange={(e) => setFounding(e.target.value)}
              inputMode="decimal"
              className={input}
            />
          </label>
        )}
        <div className="flex items-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="min-h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        New prices apply to new purchases. Existing monthly plans keep their price.
      </p>
    </li>
  );
}

// ---------- Deals ----------

const EMPTY_DEAL: DealInput = {
  placement: "essentials",
  partner: "",
  title: "",
  blurb: "",
  url: "https://",
  cta: "View deal",
  image_url: null,
  active: false,
  sort_order: 0,
};

function Deals() {
  const queryClient = useQueryClient();
  const { data: deals } = useQuery({ queryKey: ["admin", "deals"], queryFn: fetchAllDeals });
  const [editing, setEditing] = useState<{ id: string | null; input: DealInput } | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "deals"] });
    void queryClient.invalidateQueries({ queryKey: ["deals"] });
  }

  async function toggle(d: Deal) {
    try {
      await saveDeal(d.id, { ...dealInput(d), active: !d.active });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    }
  }

  async function remove(d: Deal) {
    if (!window.confirm(`Delete "${d.title}"?`)) return;
    try {
      await deleteDeal(d.id);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
        Join each partner's affiliate programme (Awin, eBay Partner Network, Amazon Associates…),
        paste your tracking link here, then switch the deal on. Deals show on Essentials, EV
        chargers, fuel prices and Buy &amp; Sell with an "Ad" label. Plus members never see them.
      </p>
      <button
        type="button"
        onClick={() => setEditing({ id: null, input: EMPTY_DEAL })}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        <Plus className="size-4" /> Add a deal
      </button>
      {editing && (
        <DealForm
          initial={editing.input}
          onCancel={() => setEditing(null)}
          onSave={async (input) => {
            await saveDeal(editing.id, input);
            setEditing(null);
            refresh();
          }}
        />
      )}
      <ul className="space-y-2">
        {deals?.map((d) => (
          <li
            key={d.id}
            className={`flex items-center gap-3 rounded-xl border border-border p-3 ${d.active ? "" : "opacity-60"}`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {d.title} <span className="font-normal text-muted-foreground">· {d.partner}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {DEAL_PLACEMENTS.find((p) => p.value === d.placement)?.label} · {d.clicks} clicks ·{" "}
                {d.url}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggle(d)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${d.active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted"}`}
            >
              {d.active ? "On" : "Off"}
            </button>
            <button
              type="button"
              aria-label="Edit deal"
              onClick={() => setEditing({ id: d.id, input: dealInput(d) })}
              className="rounded-full bg-muted p-1.5"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Delete deal"
              onClick={() => remove(d)}
              className="rounded-full bg-muted p-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function dealInput(d: Deal): DealInput {
  const { id: _id, clicks: _clicks, ...rest } = d;
  return rest;
}

function DealForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: DealInput;
  onSave: (input: DealInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState<DealInput>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setD(initial), [initial]);
  const set = <K extends keyof DealInput>(k: K, v: DealInput[K]) => setD((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...d, image_url: d.image_url?.trim() ? d.image_url.trim() : null });
      toast.success("Deal saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-border p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={d.placement}
          onChange={(e) => set("placement", e.target.value as DealInput["placement"])}
          className={input}
          aria-label="Where it shows"
        >
          {DEAL_PLACEMENTS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          value={d.partner}
          onChange={(e) => set("partner", e.target.value)}
          required
          maxLength={60}
          placeholder="Partner, e.g. Blackcircles"
          className={input}
        />
        <input
          value={d.title}
          onChange={(e) => set("title", e.target.value)}
          required
          maxLength={80}
          placeholder="Title"
          className={input}
        />
        <input
          value={d.cta}
          onChange={(e) => set("cta", e.target.value)}
          required
          maxLength={30}
          placeholder="Button text"
          className={input}
        />
      </div>
      <input
        value={d.blurb}
        onChange={(e) => set("blurb", e.target.value)}
        maxLength={160}
        placeholder="One line about the deal"
        className={input}
      />
      <input
        value={d.url}
        onChange={(e) => set("url", e.target.value)}
        required
        pattern="https://.+"
        placeholder="Your affiliate link (https://…)"
        className={input}
      />
      <input
        value={d.image_url ?? ""}
        onChange={(e) => set("image_url", e.target.value)}
        pattern="https://.+"
        placeholder="Logo image link (optional, https://…)"
        className={input}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={d.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          Show it
        </label>
        <label className="flex items-center gap-2 text-sm">
          Order
          <input
            type="number"
            value={d.sort_order}
            onChange={(e) => set("sort_order", Number(e.target.value) || 0)}
            className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
        </label>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onCancel} className="rounded-md px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save deal"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ---------- Sponsors ----------

function Sponsors() {
  const { data: challenges } = useQuery({
    queryKey: ["admin", "challenges-sponsors"],
    queryFn: fetchChallenges,
  });
  const today = new Date().toISOString().slice(0, 10);
  const current = (challenges ?? []).filter((c) => c.ends_on >= today);
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
        Agree a fee or prize with a brand (invoice them outside the app), then add them to a weekly
        challenge. Members see one small "Sponsored by…" line on the challenge. Create challenges in
        the Challenges tab.
      </p>
      {current.length === 0 && (
        <p className="text-sm text-muted-foreground">No current or upcoming challenges.</p>
      )}
      {current.map((c) => (
        <SponsorRow key={c.id} challenge={c as SponsorChallenge} />
      ))}
    </div>
  );
}

type SponsorChallenge = {
  id: string;
  title: string;
  tag: string;
  starts_on: string;
  ends_on: string;
  sponsor_name?: string | null;
  sponsor_url?: string | null;
  prize?: string | null;
};

function SponsorRow({ challenge }: { challenge: SponsorChallenge }) {
  const [name, setName] = useState(challenge.sponsor_name ?? "");
  const [url, setUrl] = useState(challenge.sponsor_url ?? "");
  const [prize, setPrize] = useState(challenge.prize ?? "");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSponsorship(challenge.id, {
        sponsor_name: name.trim() || null,
        sponsor_url: url.trim() || null,
        prize: prize.trim() || null,
      });
      toast.success("Sponsor saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-2 rounded-xl border border-border p-4">
      <p className="text-sm font-semibold">
        {challenge.title} <span className="text-muted-foreground">#{challenge.tag}</span>
        <span className="block text-xs font-normal text-muted-foreground">
          {new Date(challenge.starts_on).toLocaleDateString("en-GB")} –{" "}
          {new Date(challenge.ends_on).toLocaleDateString("en-GB")}
        </span>
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Sponsor name"
          className={input}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          pattern="https://.+"
          placeholder="Sponsor website (https://…)"
          className={input}
        />
        <input
          value={prize}
          onChange={(e) => setPrize(e.target.value)}
          maxLength={120}
          placeholder="Prize, e.g. £50 detailing kit"
          className={input}
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="min-h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

// ---------- Shop ----------

function Shop() {
  const queryClient = useQueryClient();
  const settings = useMoneySettings();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (settings) {
      setUrl(settings.shop_url);
      setLabel(settings.shop_label);
    }
  }, [settings]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (url.trim() && !url.trim().startsWith("https://")) {
      toast.error("The shop link must start with https://");
      return;
    }
    setSaving(true);
    try {
      await saveSetting("shop_url", url.trim());
      await saveSetting("shop_label", label.trim() || "RevMate shop");
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success(url.trim() ? "Shop link saved" : "Shop link removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
        Sell stickers and merch with no stock: set up a free print-on-demand shop (Teemill, Printful
        + Shopify, or Etsy) and paste its link. It shows in the menu and in Settings. Leave it blank
        to hide it.
      </p>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://your-shop…"
        className={input}
      />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={40}
        placeholder="Menu label, e.g. RevMate shop"
        className={input}
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="min-h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {settings?.shop_url && (
          <a
            href={settings.shop_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary"
          >
            Open shop <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </form>
  );
}

// ---------- Payments ----------

function Payments() {
  const { data: payments, error } = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: fetchRecentPayments,
  });
  const { data: products } = useQuery({ queryKey: ["admin", "products"], queryFn: fetchProducts });
  const name = (code: string) => products?.find((p) => p.code === code)?.name ?? code;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        The latest 50 payments. Refunds and disputes are handled in your Stripe dashboard.
      </p>
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      <ul className="divide-y divide-border rounded-xl border border-border text-sm">
        {payments?.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="min-w-0">
              <span className="font-medium">{name(p.product_code)}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {p.username ? `@${displayUsernameWithoutAt(p.username)}` : "Deleted account"} ·{" "}
                {new Date(p.created_at).toLocaleString("en-GB")}
              </span>
            </span>
            <span className="flex items-center gap-2 font-semibold tabular-nums">
              {p.status === "refunded" ? (
                <span className="text-xs font-normal text-muted-foreground">refunded</span>
              ) : (
                <Check className="size-3.5 text-emerald-600" />
              )}
              {formatPence(p.amount_pence)}
            </span>
          </li>
        ))}
        {payments?.length === 0 && (
          <li className="px-3 py-4 text-muted-foreground">No payments yet.</li>
        )}
      </ul>
    </div>
  );
}
