import { useState } from "react";
import { SHOP_CATEGORIES, type ShopCategory, type ShopInput } from "@/lib/shops";

const input = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm";

/** Shop details: used to apply for a shop and to edit it. */
export function ShopForm({
  initial,
  submitLabel,
  saving,
  onSubmit,
}: {
  initial?: Partial<ShopInput>;
  submitLabel: string;
  saving: boolean;
  onSubmit: (input: ShopInput) => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [tagline, setTagline] = useState(initial?.tagline ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "https://");
  const [logo, setLogo] = useState(initial?.logo_url ?? "");
  const [categories, setCategories] = useState<ShopCategory[]>(initial?.categories ?? []);
  const [madeInUk, setMadeInUk] = useState(initial?.made_in_uk ?? false);

  function toggle(id: ShopCategory) {
    setCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < 4 ? [...prev, id] : prev,
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (categories.length === 0) return;
        void onSubmit({
          name: name.trim(),
          tagline: tagline.trim(),
          description: description.trim(),
          website: website.trim(),
          logo_url: logo.trim() ? logo.trim() : null,
          categories,
          made_in_uk: madeInUk,
        });
      }}
    >
      <label className="block text-sm font-medium">
        Shop name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={60}
          className={`mt-1 ${input}`}
        />
      </label>
      <label className="block text-sm font-medium">
        One line about it
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={120}
          placeholder="e.g. Hand-poured car air fresheners from Blackpool"
          className={`mt-1 ${input}`}
        />
      </label>
      <label className="block text-sm font-medium">
        Your website or online shop
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          required
          pattern="https://.+"
          placeholder="https://"
          className={`mt-1 ${input}`}
        />
        <span className="mt-1 block text-xs font-normal text-muted-foreground">
          Etsy, eBay shop, Shopify or your own site. Must start with https://
        </span>
      </label>
      <fieldset>
        <legend className="text-sm font-medium">What do you sell? (up to 4)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SHOP_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={categories.includes(c.id)}
              onClick={() => toggle(c.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${categories.includes(c.id) ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        {categories.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">Pick at least one.</p>
        )}
      </fieldset>
      <label className="block text-sm font-medium">
        About your shop
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1500}
          rows={4}
          className={`mt-1 resize-none ${input}`}
        />
      </label>
      <label className="block text-sm font-medium">
        Logo image link (optional)
        <input
          value={logo}
          onChange={(e) => setLogo(e.target.value)}
          pattern="https://.+"
          placeholder="https://…/logo.png"
          className={`mt-1 ${input}`}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={madeInUk} onChange={(e) => setMadeInUk(e.target.checked)} />
        We make our products in the UK
      </label>
      <button
        type="submit"
        disabled={saving || categories.length === 0}
        className="min-h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
