import { useEffect, useState } from "react";
import { BellRing, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { usePushFeature } from "@/lib/features";
import {
  disablePush,
  enablePush,
  isPushEnabledOnThisDevice,
  isPushSupported,
  needsHomeScreenInstall,
} from "@/lib/push";

/** Settings switch for phone push notifications on this device. */
export function PushNotificationToggle({ userId }: { userId: string }) {
  const available = usePushFeature();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!available) return;
    void isPushEnabledOnThisDevice().then(setEnabled);
  }, [available]);

  if (!available) return null;

  if (needsHomeScreenInstall()) {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Smartphone className="mt-0.5 size-4 shrink-0" />
        On iPhone, add RevMate to your Home Screen first (Share → Add to Home Screen), then open it
        from there and switch notifications on here.
      </p>
    );
  }
  if (!isPushSupported()) {
    return (
      <p className="text-sm text-muted-foreground">
        This browser doesn't support phone notifications.
      </p>
    );
  }

  async function toggle() {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        toast.success("Phone notifications turned off on this device");
      } else {
        await enablePush(userId);
        setEnabled(true);
        toast.success("Phone notifications turned on");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change notifications");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="flex items-start gap-2 text-sm">
        <BellRing className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          Get likes, comments, messages and meet reminders on this device, even when RevMate is
          closed.
        </span>
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={!!enabled}
        aria-label="Phone notifications"
        onClick={toggle}
        disabled={busy || enabled === null}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-[22px]" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}
