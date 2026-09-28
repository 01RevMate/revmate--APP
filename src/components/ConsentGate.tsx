import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BirthDateSelect } from "@/components/BirthDateSelect";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MIN_AGE, recordConsents, TERMS_VERSION, useAccountConsents } from "@/lib/legal";

/**
 * Asks signed-in people for anything sign-up didn't collect: their date of
 * birth (accounts from before age checks) and agreement to the current Terms
 * and Privacy Policy (whenever TERMS_VERSION changes). Stays out of the way
 * on the legal pages so they can be read first.
 */
export function ConsentGate() {
  const { user } = useAuth();
  const { available, consents, isLoading } = useAccountConsents();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const queryClient = useQueryClient();
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [marketingChoice, setMarketing] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const marketing = marketingChoice ?? consents?.marketing_opt_in ?? false;
  const needsBirthDate = !consents?.birth_date;
  const needsTerms = consents?.terms_version !== TERMS_VERSION;
  const onLegalPage = /^\/(legal\/|community-standards)/.test(pathname);
  const open =
    !!user && !isLoading && !!available && (needsBirthDate || needsTerms) && !onLegalPage;
  if (!open) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const born = consents?.birth_date ?? birthDate;
    if (!born || !agreeTerms || !agreePrivacy) return;
    setSaving(true);
    try {
      const result = await recordConsents({ birthDate: born, marketing });
      if (result === "under_age") {
        await supabase.auth.signOut();
        toast.error(`RevMate is for people ${MIN_AGE} and over, so your account has been deleted.`);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["account-consents"] });
      toast.success("Thanks — you're all set.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-md [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {needsBirthDate ? "Confirm your age" : "We've updated our terms"}
          </DialogTitle>
          <DialogDescription>
            {needsBirthDate
              ? "To keep RevMate safe and right for everyone's age, we now ask everyone for their date of birth. It's private and never shown on your profile."
              : "Please review and agree to keep using RevMate."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          {needsBirthDate && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Date of birth</p>
              <BirthDateSelect onChange={setBirthDate} />
              <p className="text-xs text-muted-foreground">
                Make sure it's right — it can't be changed later.
              </p>
            </div>
          )}
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span>
              I agree to the{" "}
              <Link to="/legal/terms" target="_blank" className="font-medium underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/community-standards" target="_blank" className="font-medium underline">
                Community Standards
              </Link>
              .
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={agreePrivacy}
              onChange={(e) => setAgreePrivacy(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span>
              I've read the{" "}
              <Link to="/legal/privacy" target="_blank" className="font-medium underline">
                Privacy Policy
              </Link>{" "}
              and understand how RevMate uses my information.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            Optional: email me RevMate news, new features and offers.
          </label>
          <Button
            type="submit"
            className="w-full"
            disabled={saving || !agreeTerms || !agreePrivacy || (needsBirthDate && !birthDate)}
          >
            {saving ? "Saving…" : "Agree and continue"}
          </Button>
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="w-full text-center text-xs text-muted-foreground underline"
          >
            Log out instead
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
