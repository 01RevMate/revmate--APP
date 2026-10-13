import { useState } from "react";
import { Check, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { absoluteUrl } from "@/lib/seo";

/**
 * Shares a marketplace advert through the phone's native share sheet
 * (WhatsApp, Messages, etc.), falling back to copying the link on
 * devices without one — e.g. most desktop browsers.
 */
export function ShareListingButton({
  listingId,
  title,
  className = "",
}: {
  listingId: string;
  title: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function share() {
    setBusy(true);
    const url = absoluteUrl(`/marketplace/${listingId}`);
    const text = `${title} — for sale on RevMate`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      toast.success("Link copied — paste it anywhere");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // The share sheet was closed without sharing — not an error.
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof DOMException && err.name === "NotAllowedError") return;
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true);
        toast.success("Link copied — paste it anywhere");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Couldn't share this advert");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      disabled={busy}
      aria-label={`Share ${title}`}
      className={`flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${className}`}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : copied ? (
        <Check className="size-4" />
      ) : (
        <Share2 className="size-4" />
      )}
      Share
    </button>
  );
}
