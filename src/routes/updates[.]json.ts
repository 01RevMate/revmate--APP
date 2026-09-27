import { createFileRoute } from "@tanstack/react-router";
import { changelogFeed } from "@/lib/changelog";

// Machine-readable release history, so people and AI assistants can check
// which RevMate version is live and what it includes. Same data as the
// App updates page at /legal/updates.
export const Route = createFileRoute("/updates.json")({
  server: {
    handlers: {
      GET: () =>
        Response.json(changelogFeed(), {
          headers: {
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
          },
        }),
    },
  },
});
