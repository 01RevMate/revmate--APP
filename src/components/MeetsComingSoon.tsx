import { CalendarDays } from "lucide-react";

/** Shown on the meets pages until the social features SQL has been run. */
export function MeetsComingSoon() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-center">
      <CalendarDays className="mx-auto size-10 text-muted-foreground" />
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Car meets are coming soon</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You'll be able to post meets, see who's going and get a reminder the day before.
      </p>
    </main>
  );
}
