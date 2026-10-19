import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { CAMPAIGNS } from "@/lib/campaigns";
import { looseDb } from "@/lib/looseDb";
import { saveSetting, useMoneySettings } from "@/lib/money";
import { PRIMARY_ORIGIN } from "@/lib/siteDomains";
import { isValidPixelId } from "@/lib/tiktokPixel";

// Admin → Marketing: TikTok links, which campaigns bring people in, the
// TikTok Pixel ID and the Android app link. Counts only — nobody is tracked.

type Row = { campaign: string; source: string; visits: number; signups: number };

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function copy(text: string) {
  void navigator.clipboard
    .writeText(text)
    .then(() => toast.success("Link copied"))
    .catch(() => toast.error("Couldn't copy — press and hold the link instead"));
}

export function AdminMarketing() {
  const [days, setDays] = useState(30);
  const stats = useQuery({
    queryKey: ["admin", "campaign-stats", days],
    queryFn: async () => {
      const { data, error } = await looseDb.rpc("admin_campaign_stats", { p_days: days });
      if (error) throw new Error(error.message);
      return data as Row[];
    },
    retry: false,
  });

  return (
    <section className="mt-6 space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Marketing</h2>
        <p className="text-sm text-muted-foreground">
          Links for TikTok, and which posts and ads bring people in. Counts only.
        </p>
      </div>

      <div>
        <h3 className="font-semibold">Your links</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Put the <strong>bio link</strong> in your TikTok profile. Use a page link in each post's
          caption or comments, and the <strong>ad link</strong> as the website in TikTok Ads
          Manager, so ad visits are counted separately.
        </p>
        <ul className="mt-3 space-y-2">
          <LinkRow label="Bio link (everything)" url={`${PRIMARY_ORIGIN}/go/tiktok`} />
          {CAMPAIGNS.map((c) => (
            <LinkRow
              key={c.slug}
              label={`${c.emoji} ${c.headline}`}
              url={`${PRIMARY_ORIGIN}/go/${c.slug}`}
              adUrl={`${PRIMARY_ORIGIN}/go/${c.slug}?utm_source=tiktok&utm_medium=paid&utm_campaign=${c.slug}`}
            />
          ))}
        </ul>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">What's working</h3>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            aria-label="Period"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        {stats.error ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Run SQL step 25 (campaigns) to see this.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Campaign</th>
                  <th className="px-3 py-2 font-medium">From</th>
                  <th className="px-3 py-2 text-right font-medium">Visits</th>
                  <th className="px-3 py-2 text-right font-medium">Sign-ups</th>
                </tr>
              </thead>
              <tbody>
                {stats.data?.map((r) => (
                  <tr key={`${r.campaign}-${r.source}`} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{r.campaign}</td>
                    <td className="px-3 py-2">{r.source}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.visits}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.signups}</td>
                  </tr>
                ))}
                {stats.data?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                      Nothing yet. Share a link above and check back.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PixelSettings />
      <AndroidSettings />
    </section>
  );
}

function LinkRow({ label, url, adUrl }: { label: string; url: string; adUrl?: string }) {
  return (
    <li className="rounded-xl border border-border p-3">
      <p className="truncate text-sm font-semibold">{label}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy(url)}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold"
        >
          <Copy className="size-3" /> {url.replace(/^https:\/\//, "")}
        </button>
        {adUrl && (
          <button
            type="button"
            onClick={() => copy(adUrl)}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold"
          >
            <Copy className="size-3" /> Ad link
          </button>
        )}
      </div>
    </li>
  );
}

function useSettingField(key: "tiktok_pixel_id" | "android_package" | "android_fingerprint") {
  const settings = useMoneySettings();
  const [value, setValue] = useState("");
  useEffect(() => {
    if (settings) setValue(settings[key]);
  }, [settings, key]);
  return [value, setValue] as const;
}

function PixelSettings() {
  const queryClient = useQueryClient();
  const [pixel, setPixel] = useSettingField("tiktok_pixel_id");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const id = pixel.trim().toUpperCase();
    if (id && !isValidPixelId(id)) {
      toast.error("That doesn't look like a TikTok Pixel ID (letters and numbers only)");
      return;
    }
    setSaving(true);
    try {
      await saveSetting("tiktok_pixel_id", id);
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success(id ? "Pixel saved" : "Pixel removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <h3 className="font-semibold">TikTok Pixel</h3>
      <p className="text-sm text-muted-foreground">
        From TikTok Ads Manager → Assets → Events → Web events. Once saved, visitors are asked
        whether they allow ad cookies, and the pixel only runs for people who say yes (never for
        under-18 accounts). Leave blank to turn it off.
      </p>
      <div className="flex gap-2">
        <input
          value={pixel}
          onChange={(e) => setPixel(e.target.value)}
          placeholder="e.g. C4ABCDEF1234567890"
          className={input}
          autoCapitalize="characters"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </form>
  );
}

function AndroidSettings() {
  const queryClient = useQueryClient();
  const [pkg, setPkg] = useSettingField("android_package");
  const [fingerprint, setFingerprint] = useSettingField("android_fingerprint");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const p = pkg.trim();
    const f = fingerprint.trim().toUpperCase();
    if (p && !/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(p)) {
      toast.error("Package names look like app.revmate.twa");
      return;
    }
    if (f && !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f)) {
      toast.error("The fingerprint should be 32 pairs like AB:CD:… (SHA-256)");
      return;
    }
    setSaving(true);
    try {
      await saveSetting("android_package", p);
      await saveSetting("android_fingerprint", f);
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Android app link saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <h3 className="font-semibold">Android app (Google Play)</h3>
      <p className="text-sm text-muted-foreground">
        Only needed once you publish RevMate on Google Play (see APP_STORE_GUIDE.md). Paste the
        package name and SHA-256 fingerprint from PWABuilder or Play Console → App signing. This
        lets the Play app open full-screen without a browser bar.
      </p>
      <input
        value={pkg}
        onChange={(e) => setPkg(e.target.value)}
        placeholder="Package name, e.g. app.revmate.twa"
        className={input}
      />
      <input
        value={fingerprint}
        onChange={(e) => setFingerprint(e.target.value)}
        placeholder="SHA-256 fingerprint, e.g. AB:CD:EF:…"
        className={input}
      />
      <button
        type="submit"
        disabled={saving}
        className="min-h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        Save
      </button>
    </form>
  );
}
