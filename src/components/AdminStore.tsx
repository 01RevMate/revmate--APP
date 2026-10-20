import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { looseDb } from "@/lib/looseDb";
import { formatPence, saveSetting, useMoneySettings } from "@/lib/money";
import { SHOP_CATEGORIES, slugify } from "@/lib/shops";
import {
  deleteStoreProduct,
  fetchAllOrders,
  fetchAllStoreProducts,
  fetchSupplier,
  ORDER_STATUS_LABEL,
  saveStoreProduct,
  updateOrder,
  type ProductEdit,
  type StoreOrder,
  type StoreProduct,
  type SupplierInfo,
} from "@/lib/store";

// Admin → Store: products (with private supplier details), orders and
// fulfilment (forward to the supplier or partner, add tracking), settings.

type Tab = "orders" | "products" | "settings";
const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const pounds = (pence: number | null) => (pence === null ? "" : (pence / 100).toFixed(2));
const toPence = (v: string) => (v.trim() ? Math.round(Number(v) * 100) : null);

export function AdminStore() {
  const [tab, setTab] = useState<Tab>("orders");
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">RevMate Store</h2>
      <p className="text-sm text-muted-foreground">
        Products RevMate sells and delivers. Supplier details and costs are only visible here.
      </p>
      <div className="mt-4 flex gap-2">
        {(["orders", "products", "settings"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold capitalize ${tab === t ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "orders" && <Orders />}
        {tab === "products" && <Products />}
        {tab === "settings" && <Settings />}
      </div>
    </section>
  );
}

// ---------- Orders ----------

function Orders() {
  const { data: orders, error } = useQuery({
    queryKey: ["admin", "store-orders"],
    queryFn: fetchAllOrders,
  });
  const [filter, setFilter] = useState<"todo" | "all">("todo");
  const shown = (orders ?? []).filter(
    (o) => filter === "all" || o.status === "paid" || o.status === "ordered",
  );
  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setFilter("todo")}
          className={`rounded-full px-3 py-1 ${filter === "todo" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          To send (
          {(orders ?? []).filter((o) => o.status === "paid" || o.status === "ordered").length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          All
        </button>
      </div>
      {error && <p className="text-sm text-muted-foreground">Run SQL step 27 to use the store.</p>}
      {shown.map((o) => (
        <OrderCard key={o.id} order={o} />
      ))}
      {orders && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing to send.</p>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: StoreOrder }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(order.status);
  const [carrier, setCarrier] = useState(order.tracking_carrier ?? "");
  const [number, setNumber] = useState(order.tracking_number ?? "");
  const [url, setUrl] = useState(order.tracking_url ?? "");
  const [note, setNote] = useState(order.admin_note);
  const [saving, setSaving] = useState(false);
  const ids = order.items.map((i) => i.product_id);
  const { data: suppliers } = useQuery({
    queryKey: ["admin", "suppliers", ids.join(",")],
    queryFn: async () => {
      const { data } = await looseDb.from("store_suppliers").select("*").in("product_id", ids);
      return (data as (SupplierInfo & { product_id: string })[]) ?? [];
    },
  });
  const a = order.shipping_address ?? {};
  const address = [order.shipping_name, a["line1"], a["line2"], a["city"], a["postal_code"]]
    .filter(Boolean)
    .join(", ");

  async function save() {
    if (url.trim() && !url.trim().startsWith("https://")) {
      toast.error("Tracking links must start with https://");
      return;
    }
    setSaving(true);
    try {
      await updateOrder(order.id, {
        status,
        tracking_carrier: carrier.trim() || null,
        tracking_number: number.trim() || null,
        tracking_url: url.trim() || null,
        admin_note: note,
      });
      toast.success("Order updated — the customer has been notified");
      void queryClient.invalidateQueries({ queryKey: ["admin", "store-orders"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-xl border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">
          #{order.id.slice(0, 8)} · {ORDER_STATUS_LABEL[order.status]}
        </p>
        <p className="font-bold tabular-nums">{formatPence(order.total_pence)}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {new Date(order.paid_at ?? order.created_at).toLocaleString("en-GB")} · {order.email}
        {a["phone"] ? ` · ${a["phone"]}` : ""}
      </p>
      <p className="mt-1 text-xs">
        <span className="font-semibold">Deliver to:</span> {address || "—"}
      </p>
      <ul className="mt-2 space-y-1">
        {order.items.map((it) => {
          const s = suppliers?.find((x) => x.product_id === it.product_id);
          return (
            <li key={it.product_id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {it.qty} × {it.title}
              </span>
              {s?.supplier_url ? (
                <a
                  href={s.supplier_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary"
                >
                  Order from {s.supplier || "supplier"} <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {s?.supplier ?? "No supplier set"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StoreOrder["status"])}
          className={input}
          aria-label="Status"
        >
          {(["paid", "ordered", "shipped", "delivered", "cancelled", "refunded"] as const).map(
            (s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ),
          )}
        </select>
        <input
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          placeholder="Carrier (e.g. Royal Mail)"
          className={input}
        />
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Tracking number"
          className={input}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Tracking link (https://…)"
          className={input}
        />
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Private note (supplier order no., etc.)"
        className={`mt-2 ${input}`}
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        Refunds: issue them in Stripe; the order is marked refunded automatically.
      </p>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-2 min-h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </article>
  );
}

// ---------- Products ----------

const EMPTY_PRODUCT: ProductEdit = {
  slug: "",
  title: "",
  brand: "",
  description: "",
  images: [],
  category: "detailing",
  price_pence: 999,
  was_price_pence: null,
  delivery_pence: 399,
  delivery_estimate: "3–5 working days",
  fulfilment: "dropship",
  stock: null,
  fits_makes: [],
  active: false,
  sort_order: 0,
};
const EMPTY_SUPPLIER: SupplierInfo = {
  supplier: "",
  supplier_url: null,
  supplier_sku: "",
  cost_pence: null,
  notes: "",
};

function Products() {
  const queryClient = useQueryClient();
  const { data: products } = useQuery({
    queryKey: ["admin", "store-products"],
    queryFn: fetchAllStoreProducts,
  });
  const [editing, setEditing] = useState<{ product: StoreProduct | null } | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "store-products"] });
    void queryClient.invalidateQueries({ queryKey: ["store"] });
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setEditing({ product: null })}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        <Plus className="size-4" /> Add product
      </button>
      {editing && (
        <ProductForm
          product={editing.product}
          onDone={() => {
            setEditing(null);
            refresh();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      <ul className="space-y-2">
        {products?.map((p) => (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded-xl border border-border p-3 text-sm ${p.active ? "" : "opacity-60"}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{p.title}</span>
              <span className="text-xs text-muted-foreground">
                {formatPence(p.price_pence)} · {p.fulfilment} ·{" "}
                {p.stock === null ? "no stock limit" : `${p.stock} in stock`} · {p.sold_count} sold
              </span>
            </span>
            <button
              type="button"
              aria-label="Edit"
              onClick={() => setEditing({ product: p })}
              className="rounded-full bg-muted p-1.5"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Delete"
              onClick={async () => {
                if (!window.confirm(`Delete ${p.title}?`)) return;
                try {
                  await deleteStoreProduct(p.id);
                  refresh();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Couldn't delete");
                }
              }}
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

function ProductForm({
  product,
  onDone,
  onCancel,
}: {
  product: StoreProduct | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const start = product ?? { ...EMPTY_PRODUCT, id: "", sold_count: 0 };
  const [title, setTitle] = useState(start.title);
  const [brand, setBrand] = useState(start.brand);
  const [description, setDescription] = useState(start.description);
  const [images, setImages] = useState(start.images.join("\n"));
  const [category, setCategory] = useState(start.category);
  const [price, setPrice] = useState(pounds(start.price_pence));
  const [was, setWas] = useState(pounds(start.was_price_pence));
  const [delivery, setDelivery] = useState(pounds(start.delivery_pence));
  const [estimate, setEstimate] = useState(start.delivery_estimate);
  const [fulfilment, setFulfilment] = useState(start.fulfilment);
  const [stock, setStock] = useState(start.stock === null ? "" : String(start.stock));
  const [fits, setFits] = useState(start.fits_makes.join(", "));
  const [active, setActive] = useState(start.active);
  const [supplier, setSupplier] = useState<SupplierInfo>(EMPTY_SUPPLIER);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) void fetchSupplier(product.id).then((s) => s && setSupplier(s));
  }, [product]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const priceP = toPence(price);
    const deliveryP = toPence(delivery) ?? 0;
    if (!priceP || priceP < 50) {
      toast.error("Price must be at least £0.50");
      return;
    }
    const imageList = images
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (imageList.some((u) => !u.startsWith("https://"))) {
      toast.error("Image links must start with https://");
      return;
    }
    setSaving(true);
    try {
      await saveStoreProduct(
        product?.id ?? null,
        {
          slug: product?.slug ?? `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`,
          title: title.trim(),
          brand: brand.trim(),
          description: description.trim(),
          images: imageList.slice(0, 8),
          category,
          price_pence: priceP,
          was_price_pence: toPence(was),
          delivery_pence: deliveryP,
          delivery_estimate: estimate.trim() || "3–5 working days",
          fulfilment,
          stock: stock.trim() ? Math.max(0, Math.round(Number(stock))) : null,
          fits_makes: fits
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean),
          active,
          sort_order: start.sort_order,
        },
        {
          ...supplier,
          supplier_url: supplier.supplier_url?.trim() ? supplier.supplier_url.trim() : null,
        },
      );
      toast.success("Product saved");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-border p-4 text-sm">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        minLength={2}
        maxLength={120}
        placeholder="Product title"
        className={input}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          maxLength={60}
          placeholder="Brand"
          className={input}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={input}
          aria-label="Category"
        >
          {SHOP_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={4000}
        rows={4}
        placeholder="Description"
        className={`resize-none ${input}`}
      />
      <textarea
        value={images}
        onChange={(e) => setImages(e.target.value)}
        rows={2}
        placeholder="Image links, one per line (https://…)"
        className={`resize-none ${input}`}
      />
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted-foreground">
          Price £
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            className={input}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Was £ (optional)
          <input
            value={was}
            onChange={(e) => setWas(e.target.value)}
            inputMode="decimal"
            className={input}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Delivery £
          <input
            value={delivery}
            onChange={(e) => setDelivery(e.target.value)}
            inputMode="decimal"
            className={input}
          />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted-foreground">
          Delivery time
          <input
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            maxLength={40}
            className={input}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Sent by
          <select
            value={fulfilment}
            onChange={(e) => setFulfilment(e.target.value as ProductEdit["fulfilment"])}
            className={input}
          >
            <option value="dropship">Drop-ship supplier</option>
            <option value="partner">UK partner</option>
            <option value="revmate">RevMate</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Stock (blank = no limit)
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            inputMode="numeric"
            className={input}
          />
        </label>
      </div>
      <input
        value={fits}
        onChange={(e) => setFits(e.target.value)}
        placeholder="Fits makes, comma separated (blank = fits all)"
        className={input}
      />
      <fieldset className="space-y-2 rounded-lg bg-muted/50 p-3">
        <legend className="text-xs font-semibold">Supplier (private)</legend>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={supplier.supplier}
            onChange={(e) => setSupplier({ ...supplier, supplier: e.target.value })}
            placeholder="Supplier name"
            className={input}
          />
          <input
            value={supplier.supplier_sku}
            onChange={(e) => setSupplier({ ...supplier, supplier_sku: e.target.value })}
            placeholder="Supplier SKU"
            className={input}
          />
        </div>
        <input
          value={supplier.supplier_url ?? ""}
          onChange={(e) => setSupplier({ ...supplier, supplier_url: e.target.value })}
          placeholder="Where to order it (https://…)"
          className={input}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={pounds(supplier.cost_pence)}
            onChange={(e) => setSupplier({ ...supplier, cost_pence: toPence(e.target.value) })}
            inputMode="decimal"
            placeholder="Your cost £"
            className={input}
          />
          <span className="self-center text-xs text-muted-foreground">
            {supplier.cost_pence !== null && toPence(price)
              ? `Margin ${formatPence((toPence(price) ?? 0) - supplier.cost_pence)} before delivery`
              : ""}
          </span>
        </div>
        <input
          value={supplier.notes}
          onChange={(e) => setSupplier({ ...supplier, notes: e.target.value })}
          placeholder="Notes"
          className={input}
        />
      </fieldset>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{" "}
          For sale
        </label>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onCancel} className="rounded-md px-3 py-2">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save product"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ---------- Settings ----------

function Settings() {
  const queryClient = useQueryClient();
  const settings = useMoneySettings();
  const [freeOver, setFreeOver] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (settings) setFreeOver(pounds(settings.store_free_delivery_over || null));
  }, [settings]);

  async function save(next?: boolean) {
    setSaving(true);
    try {
      if (next !== undefined) await saveSetting("store_enabled", next ? "true" : "false");
      await saveSetting("store_free_delivery_over", String(toPence(freeOver) ?? 0));
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  const on = settings?.store_enabled === true;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
        <div>
          <p className="font-semibold">Store is {on ? "open" : "closed"}</p>
          <p className="text-sm text-muted-foreground">
            Needs payments switched on (Admin → Money) and the store-checkout function deployed.
          </p>
        </div>
        <button
          type="button"
          disabled={saving || !settings}
          onClick={() => void save(!on)}
          className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${on ? "border border-input" : "bg-primary text-primary-foreground"}`}
        >
          {on ? "Close store" : "Open store"}
        </button>
      </div>
      <label className="block text-sm">
        Free delivery over £ (blank = never)
        <input
          value={freeOver}
          onChange={(e) => setFreeOver(e.target.value)}
          inputMode="decimal"
          className={`mt-1 ${input}`}
        />
      </label>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="min-h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        Save
      </button>
    </div>
  );
}
