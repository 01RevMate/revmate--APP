import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

/** Shown instead of a feature that unlocks at a certain age. */
export function AgeLimitNotice({ years, feature }: { years: number; feature: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <ShieldCheck className="mx-auto size-10 text-primary" />
      <h1 className="mt-4 text-xl font-semibold tracking-tight">
        {feature} unlocks at {years}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        To help keep younger members safe, {feature.toLowerCase()} is for people aged {years} and
        over. Everything else on RevMate is open to you.
      </p>
      <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary underline">
        Back to the feed
      </Link>
    </div>
  );
}
