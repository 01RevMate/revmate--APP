import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  EyeOff,
  Loader2,
  Lock,
  MapPin,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { saveMyArea } from "@/lib/businesses";
import { lookupDistrict } from "@/lib/marketDeals";
import { myAreaKey, useMyArea, useMyPlace } from "@/lib/myArea";

const USES = [
  {
    Icon: ShoppingBag,
    title: "Buy & Sell",
    text: "Your adverts show buyers roughly how far away they are, and you see how far items are from you.",
  },
  {
    Icon: CalendarDays,
    title: "Car meets",
    text: "See how far each meet is from you and find the ones nearby.",
  },
  {
    Icon: Building2,
    title: "Local businesses",
    text: "Mechanics, detailers and offers near you.",
  },
];

/**
 * "Your area": the member's private postcode district, with a clear
 * explanation of what it's used for and who can see it (nobody).
 */
export function MyAreaCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { available, district, loading } = useMyArea();
  const place = useMyPlace();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  useEffect(() => setText(district ?? ""), [district]);

  if (!available) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    try {
      const found = await lookupDistrict(text);
      await saveMyArea(userId, found.district);
      queryClient.setQueryData(["district-centre", found.district], found);
      await queryClient.invalidateQueries({ queryKey: myAreaKey(userId) });
      void queryClient.invalidateQueries({ queryKey: ["ads"] });
      toast.success(`Area set to ${found.district}${found.town ? ` (${found.town})` : ""}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your area");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await saveMyArea(userId, null);
      await queryClient.invalidateQueries({ queryKey: myAreaKey(userId) });
      void queryClient.invalidateQueries({ queryKey: ["ads"] });
      setText("");
      toast.success("Area removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove your area");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3 bg-gradient-to-br from-primary/10 to-transparent p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <MapPin className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">Your area</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              <Lock className="size-3" /> Private — only you see this
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            The first half of your postcode, so RevMate can work out roughly how far things are from
            you.
          </p>
        </div>
      </div>

      <form onSubmit={save} className="space-y-2 p-4 pt-3">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Postcode, e.g. LS6 2AB or LS6"
            maxLength={8}
            autoComplete="postal-code"
            aria-label="Your postcode"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm uppercase placeholder:normal-case"
          />
          <button
            disabled={!!busy || !text.trim() || text.trim().toUpperCase() === district}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy === "save" && <Loader2 className="size-4 animate-spin" />}
            {district ? "Update" : "Save"}
          </button>
        </div>
        {loading ? null : district ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
              <MapPin className="size-4" />
              {district}
              {place?.town ? ` · around ${place.town}` : ""}
            </span>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={!!busy}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              {busy === "remove" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Remove
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Optional. You can type your full postcode — we only ever keep the first half.
          </p>
        )}
      </form>

      <div className="border-t border-border p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          What it's used for
        </p>
        <ul className="mt-2 space-y-2.5">
          {USES.map(({ Icon, title, text: body }) => (
            <li key={title} className="flex gap-2.5 text-sm">
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <span className="font-medium">{title}</span>
                <span className="text-muted-foreground"> — {body}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2.5 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          <EyeOff className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold text-foreground">Never shown to other members.</span> It
            isn't on your profile, posts or adverts. Other people only ever see a rounded distance
            like "about 10 miles away" — never your area, street or address. Remove it any time.
          </p>
        </div>
      </div>
    </section>
  );
}
