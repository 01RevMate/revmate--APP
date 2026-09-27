import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MousePointerClick, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUploadField } from "@/components/ImageUploadField";
import {
  deletePartner,
  fetchPartners,
  savePartner,
  setPartnerActive,
  type Partner,
} from "@/lib/marketplace";

/**
 * Admin: sponsored slots on Buy & Sell. "Grid" partners appear as a tile
 * after every 8 listings; a "banner" partner sits under the search bar.
 * Clicks are counted so you can show partners what RevMate sends them.
 */
export function AdminPartners({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data: partners } = useQuery({
    queryKey: ["admin", "partners"],
    queryFn: () => fetchPartners(true),
  });
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [url, setUrl] = useState("");
  const [cta, setCta] = useState("Shop now");
  const [placement, setPlacement] = useState<Partner["placement"]>("grid");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin", "partners"] });
    queryClient.invalidateQueries({ queryKey: ["marketplace-partners"] });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const link = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    setSaving(true);
    try {
      await savePartner({
        name: name.trim(),
        tagline: tagline.trim(),
        url: link.replace(/^http:\/\//, "https://"),
        cta: cta.trim() || "Shop now",
        placement,
        image_url: imageUrl || null,
      });
      toast.success(`${name} is live on Buy & Sell`);
      setName("");
      setTagline("");
      setUrl("");
      setImageUrl("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add the partner");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  return (
    <section className="mt-6 max-w-2xl">
      <h2 className="text-lg font-semibold">Marketplace partners</h2>
      <p className="text-sm text-muted-foreground">
        Sponsored parts suppliers, HPI checks, insurance and so on. Always labelled "Sponsored" to
        buyers. To feature a member's listing, open it and use the admin Featured buttons.
      </p>

      <form onSubmit={handleAdd} className="mt-4 space-y-2 rounded-lg border border-border p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            placeholder="Partner name"
            className={input}
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="Website (https://…)"
            className={input}
          />
        </div>
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={140}
          placeholder="Tagline, e.g. Genuine BMW parts, next-day delivery"
          className={input}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            maxLength={30}
            placeholder="Button text"
            className={input}
          />
          <select
            value={placement}
            onChange={(e) => setPlacement(e.target.value as Partner["placement"])}
            className={input}
          >
            <option value="grid">Tile in the listings grid</option>
            <option value="banner">Banner under the search bar</option>
          </select>
        </div>
        <ImageUploadField
          label="Image (optional)"
          userId={userId}
          value={imageUrl}
          onChange={setImageUrl}
          shape="wide"
        />
        <button
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add partner"}
        </button>
      </form>

      <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
        {partners?.map((partner) => (
          <li key={partner.id} className="flex flex-wrap items-center gap-3 p-3">
            {partner.image_url && (
              <img src={partner.image_url} alt="" className="size-10 rounded object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {partner.name}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  · {partner.placement === "grid" ? "grid tile" : "banner"}
                </span>
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MousePointerClick className="size-3.5" /> {partner.clicks_count} clicks ·{" "}
                {partner.url}
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={partner.active}
                onChange={async (e) => {
                  await setPartnerActive(partner.id, e.target.checked).catch((err) =>
                    toast.error(err.message),
                  );
                  refresh();
                }}
              />
              Live
            </label>
            <button
              type="button"
              aria-label={`Remove ${partner.name}`}
              onClick={async () => {
                if (!window.confirm(`Remove ${partner.name}?`)) return;
                await deletePartner(partner.id).catch((err) => toast.error(err.message));
                refresh();
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {partners?.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">No partners yet.</li>
        )}
      </ul>
    </section>
  );
}
