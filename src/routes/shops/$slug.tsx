import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { ShopForm } from "@/components/ShopForm";
import { formatPence } from "@/lib/money";
import {
  deleteProduct,
  fetchShop,
  isPromotedShop,
  recordShopClick,
  saveProduct,
  shopCategoryLabel,
  updateShop,
  type ProductInput,
  type Shop,
  type ShopProduct,
} from "@/lib/shops";

export const Route = createFileRoute("/shops/$slug")({
  head: () => ({ meta: [{ title: "Shop — RevMate" }] }),
  component: ShopPage,
});

function ShopPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { isAdmin } = useProfile();
  const { data, isLoading } = useQuery({
    queryKey: ["shop", slug],
    queryFn: () => fetchShop(slug),
    retry: false,
  });

  if (isLoading) return <main className="min-h-[60vh]" />;
  if (!data) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">This shop isn't available.</p>
        <Link to="/shops" className="mt-3 inline-block text-primary underline">
          All shops
        </Link>
      </main>
    );
  }
  const { shop, products } = data;
  const owner = !!user && (user.id === shop.owner_user_id || isAdmin);
  const live = products.filter((p) => p.active);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-12 pt-6">
      <Link to="/shops" className="text-sm text-muted-foreground hover:text-foreground">
        ← All shops
      </Link>
      {shop.status !== "active" && (
        <p className="mt-3 rounded-xl bg-amber-500/15 p-3 text-sm">
          {shop.status === "pending"
            ? "Only you can see this until we've approved it."
            : "This shop wasn't approved. Contact us if you think that's a mistake."}
        </p>
      )}
      <section className="mt-3 rounded-3xl border border-border bg-card p-5">
        <div className="flex gap-4">
          <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt="" className="size-full object-contain" />
            ) : (
              <Store className="size-8 text-neutral-400" />
            )}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold leading-tight">{shop.name}</h1>
            {shop.tagline && <p className="text-sm text-muted-foreground">{shop.tagline}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {isPromotedShop(shop) && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
                  Promoted
                </span>
              )}
              {shop.made_in_uk && (
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
                  🇬🇧 Made in UK
                </span>
              )}
              {shop.categories.map((c) => (
                <span key={c} className="rounded-full bg-muted px-2 py-0.5">
                  {shopCategoryLabel(c)}
                </span>
              ))}
            </div>
          </div>
        </div>
        {shop.description && (
          <p className="mt-4 whitespace-pre-wrap break-words text-sm">{shop.description}</p>
        )}
        <a
          href={shop.website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Visit shop <ExternalLink className="size-4" />
        </a>
      </section>

      {live.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-bold">Products</h2>
          <p className="text-xs text-muted-foreground">
            You'll buy on {shop.name}'s own website. RevMate doesn't handle the sale.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {live.map((p) => (
              <li key={p.id}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => recordShopClick(p.id)}
                  className="block overflow-hidden rounded-2xl border border-border bg-card hover:bg-muted/50"
                >
                  <span className="flex aspect-square items-center justify-center bg-white">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="size-full object-cover" />
                    ) : (
                      <Store className="size-8 text-neutral-300" />
                    )}
                  </span>
                  <span className="block p-3">
                    <span className="line-clamp-2 text-sm font-medium">{p.title}</span>
                    {p.price_pence !== null && (
                      <span className="mt-1 block font-bold">{formatPence(p.price_pence)}</span>
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {owner && <ShopManager shop={shop} products={products} />}
    </main>
  );
}

const input = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm";

function ShopManager({ shop, products }: { shop: Shop; products: ShopProduct[] }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<{ id: string | null; input: ProductInput } | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["shop", shop.slug] });

  return (
    <section className="mt-8 rounded-3xl border border-dashed border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Manage your shop</h2>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="inline-flex items-center gap-1 text-sm text-primary"
        >
          <Pencil className="size-3.5" /> {editing ? "Close" : "Edit details"}
        </button>
      </div>
      {editing && (
        <div className="mt-3">
          <ShopForm
            initial={shop}
            submitLabel="Save"
            saving={saving}
            onSubmit={async (next) => {
              setSaving(true);
              try {
                await updateShop(shop.id, next);
                toast.success("Shop saved");
                setEditing(false);
                refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Couldn't save");
              } finally {
                setSaving(false);
              }
            }}
          />
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-semibold">Products ({products.length}/24)</p>
        <button
          type="button"
          disabled={products.length >= 24}
          onClick={() =>
            setProduct({
              id: null,
              input: {
                title: "",
                price_pence: null,
                image_url: null,
                url: shop.website,
                active: true,
              },
            })
          }
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="size-3.5" /> Add product
        </button>
      </div>
      {product && (
        <ProductForm
          initial={product.input}
          onCancel={() => setProduct(null)}
          onSave={async (next) => {
            await saveProduct(shop.id, product.id, next);
            setProduct(null);
            refresh();
          }}
        />
      )}
      <ul className="mt-3 space-y-2">
        {products.map((p) => (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded-xl border border-border p-2 text-sm ${p.active ? "" : "opacity-60"}`}
          >
            <span className="min-w-0 flex-1 truncate">
              {p.title}
              <span className="block text-xs text-muted-foreground">
                {p.price_pence !== null ? formatPence(p.price_pence) : "No price"} · {p.clicks} taps
              </span>
            </span>
            <button
              type="button"
              aria-label="Edit product"
              onClick={() =>
                setProduct({
                  id: p.id,
                  input: {
                    title: p.title,
                    price_pence: p.price_pence,
                    image_url: p.image_url,
                    url: p.url,
                    active: p.active,
                  },
                })
              }
              className="rounded-full bg-muted p-1.5"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Delete product"
              onClick={async () => {
                if (!window.confirm(`Delete "${p.title}"?`)) return;
                try {
                  await deleteProduct(p.id);
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
    </section>
  );
}

function ProductForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ProductInput;
  onSave: (input: ProductInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [price, setPrice] = useState(
    initial.price_pence !== null ? (initial.price_pence / 100).toFixed(2) : "",
  );
  const [url, setUrl] = useState(initial.url);
  const [image, setImage] = useState(initial.image_url ?? "");
  const [active, setActive] = useState(initial.active);
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="mt-3 space-y-2 rounded-xl border border-border p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const pence = price.trim() ? Math.round(Number(price) * 100) : null;
        if (pence !== null && !(pence >= 0)) {
          toast.error("Enter a price like 4.99");
          return;
        }
        setSaving(true);
        try {
          await onSave({
            title: title.trim(),
            price_pence: pence,
            url: url.trim(),
            image_url: image.trim() ? image.trim() : null,
            active,
          });
          toast.success("Product saved");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't save");
        } finally {
          setSaving(false);
        }
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={80}
        placeholder="Product name"
        className={input}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          placeholder="Price £ (optional)"
          className={input}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Show it
        </label>
      </div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        pattern="https://.+"
        placeholder="Link to buy it (https://…)"
        className={input}
      />
      <input
        value={image}
        onChange={(e) => setImage(e.target.value)}
        pattern="https://.+"
        placeholder="Photo link (https://…, optional)"
        className={input}
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-2 text-sm">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save product"}
        </button>
      </div>
    </form>
  );
}
