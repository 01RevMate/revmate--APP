import { createFileRoute, Link } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";

export const Route = createFileRoute("/revs")({
  head: () => ({
    meta: [
      { title: "Revs — Coming soon | RevMate" },
      { name: "description", content: "Revs, RevMate's car video feed, is coming soon." },
      { property: "og:title", content: "Revs — Coming soon | RevMate" },
      { property: "og:description", content: "Revs, RevMate's car video feed, is coming soon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RevsComingSoon,
});

function RevsComingSoon() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Clapperboard className="h-12 w-12 text-primary" aria-hidden />
      <h1 className="text-3xl font-bold">Revs — coming soon</h1>
      <p className="text-muted-foreground">
        Exhausts, launches and walkarounds. We're putting the finishing touches on it.
      </p>
      <Link to="/" className="rounded-full bg-primary px-5 py-2 font-medium text-primary-foreground">
        Back to the feed
      </Link>
    </div>
  );
}
