import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAnnouncementsFeature } from "@/lib/features";
import { TERMS_VERSION, useAccountConsents } from "@/lib/legal";
import { fetchNextAnnouncement, markAnnouncementSeen } from "@/lib/announcements";

/**
 * Shows the newest admin announcement a signed-in member hasn't seen, once,
 * shortly after the app opens. Waits for the splash screen and never stacks
 * on top of the age/terms prompt or first-run onboarding.
 */
export function AnnouncementPopup() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const available = useAnnouncementsFeature();
  const {
    available: consentsAvailable,
    consents,
    isLoading: consentsLoading,
  } = useAccountConsents();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [closedId, setClosedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  const { data: announcement } = useQuery({
    queryKey: ["announcement", "next", user?.id],
    enabled: !!user && available,
    staleTime: 10 * 60_000,
    queryFn: () => fetchNextAnnouncement(user!.id),
  });

  const otherPromptOpen =
    !profile?.onboarded_at ||
    consentsLoading ||
    (consentsAvailable && (!consents?.birth_date || consents.terms_version !== TERMS_VERSION));
  const open =
    ready &&
    !!user &&
    !!announcement &&
    announcement.id !== closedId &&
    !otherPromptOpen &&
    !/^\/(legal\/|signup|login|admin)/.test(pathname);

  if (!open || !announcement || !user) return null;

  function close(clicked: boolean) {
    setClosedId(announcement!.id);
    void markAnnouncementSeen(announcement!.id, user!.id, clicked).catch(() => {});
  }

  return (
    <Dialog open onOpenChange={(next) => !next && close(false)}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-xl sm:max-w-md">
        <DialogTitle className="sr-only">{announcement.title}</DialogTitle>
        <AnnouncementCard
          announcement={announcement}
          onClose={() => close(false)}
          onAction={() => {
            close(true);
            const url = announcement.cta_url;
            if (!url) return;
            if (url.startsWith("/")) void navigate({ to: url });
            else window.open(url, "_blank", "noopener,noreferrer");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
