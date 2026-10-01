import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchNotificationSettings, saveNotificationSettings } from "@/lib/engagement";

// What people can switch off. Muted kinds aren't created at all — not in
// the app and not on the phone.
const KINDS: { id: string; label: string }[] = [
  { id: "like", label: "Likes on your posts" },
  { id: "comment", label: "Comments on your posts" },
  { id: "comment_reply", label: "Replies to your comments" },
  { id: "comment_like", label: "Likes on your comments" },
  { id: "mention", label: "Mentions" },
  { id: "profile_follow", label: "New followers" },
  { id: "car_like", label: "Likes on your cars" },
  { id: "car_follow", label: "People following your cars" },
  { id: "repost", label: "Reposts" },
  { id: "spotted", label: "Someone spotted your car" },
  { id: "message", label: "Messages" },
  { id: "meet_rsvp", label: "RSVPs to your meets" },
  { id: "meet_reminder", label: "Meet reminders" },
  { id: "weekly_recap", label: "Weekly recap" },
  { id: "rank_up", label: "Leaderboard rank changes" },
  { id: "price_drop", label: "Price drops on your watchlist" },
  { id: "search_alert", label: "New matches for your saved searches" },
  { id: "offer", label: "Offers on your listings" },
  { id: "offer_update", label: "Replies to your offers" },
  { id: "review_request", label: "Requests to review a purchase" },
  { id: "mot_reminder", label: "MOT reminders" },
  { id: "tax_reminder", label: "Road tax reminders" },
  { id: "issue_resolved", label: "Problems you followed get fixed" },
  { id: "resolve_prompt", label: "Reminders to update your problems" },
];

export function NotificationSettingsForm({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["notification-settings", userId],
    queryFn: () => fetchNotificationSettings(userId),
  });
  const [quietHours, setQuietHours] = useState(false);
  const [muted, setMuted] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setQuietHours(settings.quiet_hours);
    setMuted(settings.muted_kinds);
  }, [settings]);

  async function save(next: { quiet_hours: boolean; muted_kinds: string[] }) {
    setSaving(true);
    try {
      await saveNotificationSettings(userId, next);
      queryClient.invalidateQueries({ queryKey: ["notification-settings", userId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save notification settings");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <label className="flex items-start justify-between gap-4">
        <span className="text-sm">
          <span className="block font-medium">Quiet hours (10pm – 8am)</span>
          <span className="block text-xs text-muted-foreground">
            No phone alerts overnight. They'll still be waiting in the app.
          </span>
        </span>
        <input
          type="checkbox"
          checked={quietHours}
          disabled={saving}
          onChange={(e) => {
            setQuietHours(e.target.checked);
            void save({ quiet_hours: e.target.checked, muted_kinds: muted });
          }}
          className="mt-1 size-5 accent-primary"
        />
      </label>
      <div>
        <p className="text-sm font-medium">Notify me about</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {KINDS.map((kind) => {
            const on = !muted.includes(kind.id);
            return (
              <li key={kind.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={saving}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? muted.filter((id) => id !== kind.id)
                        : [...muted, kind.id];
                      setMuted(next);
                      void save({ quiet_hours: quietHours, muted_kinds: next });
                    }}
                    className="size-4 accent-primary"
                  />
                  {kind.label}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
