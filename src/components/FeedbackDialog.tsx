import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageSquareHeart } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { FEEDBACK_KINDS, sendFeedback, type FeedbackKind } from "@/lib/launch";

/** Send a bug or idea straight to the RevMate team. */
export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3) return;
    setSending(true);
    try {
      await sendFeedback(kind, message, window.location.pathname);
      toast.success("Thanks! We read every message.");
      setMessage("");
      setKind("idea");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <MessageSquareHeart className="size-5 text-primary" /> Send feedback
        </DialogTitle>
        <DialogDescription>
          Found a bug or got an idea? It goes straight to the people building RevMate.
        </DialogDescription>

        {user ? (
          <form onSubmit={submit} className="space-y-3">
            <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-2">
              {FEEDBACK_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.value}
                  onClick={() => setKind(k.value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                    kind === k.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder={
                kind === "bug"
                  ? "What happened, and what did you expect?"
                  : "Tell us what you'd like to see…"
              }
              aria-label="Your feedback"
              autoFocus
            />
            <Button
              type="submit"
              className="w-full"
              disabled={sending || message.trim().length < 3}
            >
              {sending ? "Sending…" : "Send"}
            </Button>
          </form>
        ) : (
          <Button asChild className="w-full">
            <Link to="/login" onClick={() => onOpenChange(false)}>
              Log in to send feedback
            </Link>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
