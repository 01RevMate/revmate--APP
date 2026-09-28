import { Link, useRouterState } from "@tanstack/react-router";
import { safeRedirect } from "@/lib/authRedirect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuthModal } from "@/hooks/useAuthModal";
import { BrandLogo } from "@/components/BrandLogo";

export function AuthPromptModal() {
  const { isOpen, reason, close } = useAuthModal();
  // Bring people straight back to what they were doing once they've joined.
  const here = useRouterState({ select: (state) => state.location.href });
  const redirect = safeRedirect(here);
  const search = redirect && redirect !== "/" ? { redirect } : {};

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <BrandLogo className="mx-auto mb-2 h-14 w-28" />
          <DialogTitle>Join RevMate</DialogTitle>
          <DialogDescription>{reason ?? "Create a free account to continue."}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Link
            to="/signup"
            search={search}
            onClick={close}
            className="rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign up
          </Link>
          <Link
            to="/login"
            search={search}
            onClick={close}
            className="rounded-md border border-input px-4 py-2 text-center text-sm font-medium hover:bg-accent"
          >
            Log in
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
