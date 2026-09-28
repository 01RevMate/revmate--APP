import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { forgetMapsConsent } from "@/components/MapEmbed";
import { deleteMyAccount, setMarketingConsent, useAccountConsents } from "@/lib/legal";
import { fetchMyArea, postcodeDistrict, saveMyArea, useBusinessesFeature } from "@/lib/businesses";

// Everything tied to a person, for "Download my data" (UK GDPR access and
// portability). Each entry is [table, column holding the user's id].
const EXPORT_TABLES: [string, string][] = [
  ["profiles", "user_id"],
  ["account_consents", "user_id"],
  ["garage_cars", "user_id"],
  ["posts", "user_id"],
  ["post_comments", "user_id"],
  ["post_likes", "user_id"],
  ["comment_likes", "user_id"],
  ["saved_posts", "user_id"],
  ["post_poll_votes", "user_id"],
  ["profile_follows", "follower_id"],
  ["garage_car_likes", "user_id"],
  ["garage_car_dislikes", "user_id"],
  ["garage_car_follows", "user_id"],
  ["listings", "user_id"],
  ["saved_listings", "user_id"],
  ["saved_cars", "user_id"],
  ["questions", "user_id"],
  ["answers", "user_id"],
  ["group_members", "user_id"],
  ["group_join_answers", "user_id"],
  ["car_meets", "organizer_id"],
  ["meet_attendees", "user_id"],
  ["stories", "user_id"],
  ["messages", "sender_id"],
  ["notifications", "user_id"],
  ["notification_settings", "user_id"],
  ["user_blocks", "blocker_id"],
  ["post_reports", "reporter_id"],
  ["seller_reports", "reporter_id"],
  ["car_battle_votes", "voter_id"],
  ["member_areas", "user_id"],
  ["business_reviews", "user_id"],
  ["business_reports", "reporter_id"],
];

async function exportMyData(userId: string, email: string | undefined) {
  const data: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: userId, email },
  };
  for (const [table, column] of EXPORT_TABLES) {
    // Tables from SQL that hasn't run yet (or a differently named column)
    // just come back as errors and are skipped.
    const { data: rows, error } = await supabase
      .from(table as never)
      .select("*")
      .eq(column, userId)
      .limit(10000);
    if (!error) data[table] = rows;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `revmate-data-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function PrivacyDataSettings({
  userId,
  email,
}: {
  userId: string;
  email?: string | undefined;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { available, consents } = useAccountConsents();
  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const businessesOn = useBusinessesFeature();
  const { data: myArea } = useQuery({
    queryKey: ["my-area", userId],
    queryFn: () => fetchMyArea(userId),
    enabled: businessesOn,
  });
  const [areaText, setAreaText] = useState<string | null>(null);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (confirmText !== "DELETE" || !email) return;
    setDeleting(true);
    try {
      // Re-check the password so a borrowed, unlocked phone can't do this.
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error("That password isn't right.");
      await deleteMyAccount();
      await supabase.auth.signOut();
      queryClient.clear();
      toast.success("Your account and data have been deleted.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete your account.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      {available && (
        <label className="flex items-start justify-between gap-4">
          <span className="text-sm">
            <span className="block font-medium">Marketing emails</span>
            <span className="block text-xs text-muted-foreground">
              News, new features and offers from RevMate. Account and safety emails are always sent.
            </span>
          </span>
          <input
            type="checkbox"
            checked={consents?.marketing_opt_in ?? false}
            onChange={async (e) => {
              try {
                await setMarketingConsent(e.target.checked);
                await queryClient.invalidateQueries({ queryKey: ["account-consents"] });
                toast.success(e.target.checked ? "Subscribed." : "Unsubscribed.");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Couldn't save.");
              }
            }}
            className="mt-1 size-5 accent-primary"
          />
        </label>
      )}

      {businessesOn && (
        <form
          className="space-y-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            const value = (areaText ?? myArea ?? "").trim();
            const district = value ? postcodeDistrict(value) : null;
            if (value && !district) {
              toast.error("Enter your postcode or its first half, e.g. LS6.");
              return;
            }
            try {
              await saveMyArea(userId, district);
              setAreaText(null);
              await queryClient.invalidateQueries({ queryKey: ["my-area", userId] });
              await queryClient.invalidateQueries({ queryKey: ["ads"] });
              toast.success(district ? `Area set to ${district}.` : "Area removed.");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Couldn't save your area.");
            }
          }}
        >
          <span className="block text-sm font-medium">Your area</span>
          <span className="block text-xs text-muted-foreground">
            The first half of your postcode (e.g. LS6), for local businesses and offers near you.
            Only you can see it; we only keep the district, never your full address.
          </span>
          <div className="flex gap-2">
            <input
              value={areaText ?? myArea ?? ""}
              onChange={(e) => setAreaText(e.target.value)}
              placeholder="e.g. LS6"
              maxLength={8}
              className="w-32 rounded-md border border-input bg-background px-3 py-1.5 text-sm uppercase"
            />
            <button className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent">
              Save
            </button>
          </div>
        </form>
      )}

      <div className="flex items-start justify-between gap-4">
        <span className="text-sm">
          <span className="block font-medium">Maps on meets</span>
          <span className="block text-xs text-muted-foreground">
            Ask again before loading Google Maps on this device.
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            forgetMapsConsent();
            toast.success("We'll ask before showing maps.");
          }}
          className="shrink-0 rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent"
        >
          Reset
        </button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <span className="text-sm">
          <span className="block font-medium">Download my data</span>
          <span className="block text-xs text-muted-foreground">
            A copy of your profile, garage, posts, listings, messages you sent and more, as a JSON
            file.
          </span>
        </span>
        <button
          type="button"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              await exportMyData(userId, email);
            } catch {
              toast.error("Couldn't prepare your download.");
            } finally {
              setExporting(false);
            }
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
        >
          <Download className="size-3.5" /> {exporting ? "Preparing…" : "Download"}
        </button>
      </div>

      {available && (
        <div className="rounded-lg border border-destructive/30 p-4">
          <p className="text-sm font-medium text-destructive">Delete account</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Permanently deletes your account, profile, garage, posts, comments, listings and
            messages you sent. Groups you own pass to your most senior member. This can't be undone.
          </p>
          {!showDelete ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" /> Delete my account
            </button>
          ) : (
            <form onSubmit={handleDelete} className="mt-3 space-y-2">
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                placeholder='Type "DELETE" to confirm'
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  disabled={deleting || confirmText !== "DELETE" || !password}
                  className="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Permanently delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDelete(false)}
                  className="rounded-md px-3 py-2 text-sm hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
