import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { looseDb } from "@/lib/looseDb";
import { saveSetting, useMoneySettings } from "@/lib/money";
import { fetchShopsForAdmin, setShopStatus, shopCategoryLabel, type Shop } from "@/lib/shops";

// Admin → Shops & AI: approve shop applications, and switch AI diagnosis on
// with daily limits that cap what it can cost.

export function AdminShopsAi() {
  return (
    <section className="mt-6 space-y-8">
      <AiSettings />
      <ShopApprovals />
    </section>
  );
}

function AiSettings() {
  const queryClient = useQueryClient();
  const settings = useMoneySettings();
  const [siteCap, setSiteCap] = useState("300");
  const [userCap, setUserCap] = useState("15");
  const [saving, setSaving] = useState(false);
  const usage = useQuery({
    queryKey: ["admin", "ai-usage"],
    queryFn: async () => {
      const { data, error } = await looseDb.rpc("admin_ai_usage");
      if (error) throw new Error(error.message);
      return data as { today: number; people_today: number; last_30d: number };
    },
    retry: false,
  });
  const caps = useQuery({
    queryKey: ["admin", "ai-caps"],
    queryFn: async () => {
      const { data } = await looseDb
        .from("app_settings")
        .select("key, value")
        .in("key", ["ai_daily_cap", "ai_user_daily_cap"]);
      return new Map(
        ((data as { key: string; value: string }[]) ?? []).map((r) => [r.key, r.value]),
      );
    },
  });
  useEffect(() => {
    if (caps.data) {
      setSiteCap(caps.data.get("ai_daily_cap") ?? "300");
      setUserCap(caps.data.get("ai_user_daily_cap") ?? "15");
    }
  }, [caps.data]);

  async function save(next?: boolean) {
    const site = Number(siteCap);
    const per = Number(userCap);
    if (!Number.isInteger(site) || site < 0 || !Number.isInteger(per) || per < 0) {
      toast.error("Limits must be whole numbers");
      return;
    }
    if (
      next === true &&
      !window.confirm(
        "Switch AI diagnosis on? Only after the diagnose function and ANTHROPIC_API_KEY are set up.",
      )
    )
      return;
    setSaving(true);
    try {
      if (next !== undefined) await saveSetting("ai_diagnosis_enabled", next ? "true" : "false");
      await saveSetting("ai_daily_cap", String(site));
      await saveSetting("ai_user_daily_cap", String(per));
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "ai-caps"] });
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  const on = settings?.ai_diagnosis_enabled === true;
  return (
    <div>
      <h2 className="text-lg font-semibold">AI diagnosis</h2>
      <p className="text-sm text-muted-foreground">
        The "Ask RevMate AI" step in Fix a problem. Each step is one AI call (roughly 2–4p). The
        built-in step-by-step diagnosis always works, AI on or off.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
        <div>
          <p className="font-semibold">AI is {on ? "on" : "off"}</p>
          <p className="text-sm text-muted-foreground">
            Today: {usage.data?.today ?? "–"} steps by {usage.data?.people_today ?? "–"} people · 30
            days: {usage.data?.last_30d ?? "–"}
          </p>
        </div>
        <button
          type="button"
          disabled={saving || !settings}
          onClick={() => void save(!on)}
          className={`min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-60 ${on ? "border border-input" : "bg-primary text-primary-foreground"}`}
        >
          {on ? "Switch off" : "Switch on"}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          Whole-site steps per day
          <input
            value={siteCap}
            onChange={(e) => setSiteCap(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Steps per person per day
          <input
            value={userCap}
            onChange={(e) => setUserCap(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-2 min-h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        Save limits
      </button>
      {usage.error && (
        <p className="mt-2 text-sm text-muted-foreground">Run SQL step 26 to see usage.</p>
      )}
    </div>
  );
}

function ShopApprovals() {
  const queryClient = useQueryClient();
  const { data: shops, error } = useQuery({
    queryKey: ["admin", "shops"],
    queryFn: fetchShopsForAdmin,
    retry: false,
  });

  async function setStatus(shop: Shop, status: Shop["status"]) {
    try {
      await setShopStatus(shop.id, status);
      void queryClient.invalidateQueries({ queryKey: ["admin", "shops"] });
      void queryClient.invalidateQueries({ queryKey: ["shops"] });
      toast.success(status === "active" ? `${shop.name} is live` : `${shop.name} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update");
    }
  }

  const pending = shops?.filter((s) => s.status === "pending") ?? [];
  const others = shops?.filter((s) => s.status !== "pending") ?? [];
  return (
    <div>
      <h2 className="text-lg font-semibold">Shops ({pending.length} waiting)</h2>
      <p className="text-sm text-muted-foreground">
        Check the website is real, sells car-related things and nothing illegal or unsafe, then
        approve it.
      </p>
      {error && <p className="mt-2 text-sm text-muted-foreground">Run SQL step 26 to use shops.</p>}
      <ul className="mt-3 space-y-2">
        {[...pending, ...others].map((s) => (
          <li key={s.id} className="rounded-xl border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                to="/shops/$slug"
                params={{ slug: s.slug }}
                className="font-semibold hover:underline"
              >
                {s.name}
              </Link>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.status === "pending" ? "bg-amber-500/20" : s.status === "active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted"}`}
              >
                {s.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {s.categories.map(shopCategoryLabel).join(" · ")}
            </p>
            <a
              href={s.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 break-all text-xs text-primary"
            >
              {s.website} <ExternalLink className="size-3" />
            </a>
            <div className="mt-2 flex gap-2">
              {s.status !== "active" && (
                <button
                  type="button"
                  onClick={() => void setStatus(s, "active")}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                >
                  <Check className="size-3.5" /> Approve
                </button>
              )}
              {s.status !== "rejected" && (
                <button
                  type="button"
                  onClick={() => void setStatus(s, "rejected")}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold"
                >
                  <X className="size-3.5" /> {s.status === "active" ? "Take down" : "Reject"}
                </button>
              )}
            </div>
          </li>
        ))}
        {shops?.length === 0 && <li className="text-sm text-muted-foreground">No shops yet.</li>}
      </ul>
    </div>
  );
}
