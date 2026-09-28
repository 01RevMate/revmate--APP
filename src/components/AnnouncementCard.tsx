import { Megaphone, Sparkles } from "lucide-react";
import type { AnnouncementDraft } from "@/lib/announcements";

/** The body of a pop-up announcement; also used for the admin preview. */
export function AnnouncementCard({
  announcement,
  onAction,
  onClose,
}: {
  announcement: Pick<
    AnnouncementDraft,
    "kind" | "title" | "body" | "image_url" | "cta_label" | "cta_url"
  >;
  onAction?: () => void;
  onClose?: () => void;
}) {
  const Icon = announcement.kind === "update" ? Sparkles : Megaphone;
  return (
    <div className="overflow-hidden">
      {announcement.image_url ? (
        <img
          src={announcement.image_url}
          alt=""
          className="-mx-6 -mt-6 mb-4 aspect-[16/9] w-[calc(100%+3rem)] max-w-none object-cover"
        />
      ) : (
        <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      )}
      <h2 className="text-lg font-semibold leading-snug tracking-tight">
        {announcement.title || "Your title"}
      </h2>
      <div className="mt-2 max-h-[45vh] space-y-1.5 overflow-y-auto whitespace-pre-line text-sm text-muted-foreground">
        {announcement.body || "Your message"}
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {announcement.cta_label && (
          <button
            type="button"
            onClick={onAction}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            {announcement.cta_label}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className={`w-full rounded-md px-4 py-2.5 text-sm font-medium ${announcement.cta_label ? "hover:bg-accent" : "bg-primary text-primary-foreground"}`}
        >
          {announcement.cta_label ? "Maybe later" : "Got it"}
        </button>
      </div>
    </div>
  );
}
