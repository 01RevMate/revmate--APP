import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  APP_VERSION,
  changelogFeed,
  LATEST_RELEASE,
  RELEASES,
  type Release,
} from "@/lib/changelog";

export const Route = createFileRoute("/legal/updates")({
  head: () => ({
    meta: [
      { title: "App Updates — RevMate" },
      {
        name: "description",
        content: `What's new in RevMate. Current version ${APP_VERSION}, released ${LATEST_RELEASE.date}.`,
      },
      // Lets tools (and AI assistants) read the live version without parsing the page.
      { name: "revmate-version", content: APP_VERSION },
      { property: "og:title", content: "App Updates — RevMate" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "alternate", type: "application/json", href: "/updates.json" }],
  }),
  component: UpdatesPage,
});

function UpdatesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">App Updates</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Current version {APP_VERSION} · released{" "}
        {format(parseISO(LATEST_RELEASE.date), "d MMMM yyyy")}
      </p>

      <ol className="mt-8 space-y-8">
        {RELEASES.map((release) => (
          <ReleaseEntry key={release.version} release={release} />
        ))}
      </ol>

      <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
        Developers and AI assistants: this history is also available as JSON at{" "}
        <a href="/updates.json" className="text-primary underline">
          /updates.json
        </a>
        .
      </p>

      {/* Same data as /updates.json, embedded for anything reading this page directly. */}
      <script
        type="application/json"
        id="revmate-updates"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(changelogFeed()).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}

function ReleaseEntry({ release }: { release: Release }) {
  return (
    <li id={`v${release.version}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="text-base font-semibold">
          Version {release.version} — {release.title}
        </h2>
        <span className="text-xs text-muted-foreground">
          {format(parseISO(release.date), "d MMM yyyy")}
        </span>
        {release.status === "needs_database_update" && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Rolling out
          </span>
        )}
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
        {release.highlights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {release.fixes && release.fixes.length > 0 && (
        <>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-foreground">
            Fixes
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
            {release.fixes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}
