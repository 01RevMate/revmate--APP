import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Stethoscope } from "lucide-react";
import { PostComposer } from "@/components/PostComposer";

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [
      { title: "Ask for help — RevMate" },
      {
        name: "description",
        content: "Got a fault, a warning light or a noise? Ask other owners on RevMate.",
      },
      { property: "og:title", content: "Ask for help — RevMate" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AskPage,
});

// One way to ask for help: a help post in the feed. Owners can reply, the
// asker can mark it fixed, and fixes feed the "Problems & fixes" lists.
function AskPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <Stethoscope className="size-6 text-primary" /> Ask for help
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Describe the problem and tag your car. It goes in the feed so owners can help, and you can
        mark it fixed when it's sorted.
      </p>
      <div className="mt-4">
        <PostComposer
          helpPost
          onPosted={() => {
            void queryClient.invalidateQueries({ queryKey: ["feed"] });
            void navigate({ to: "/" });
          }}
        />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Someone may have had it already —{" "}
        <Link to="/issues" className="font-medium text-primary underline">
          look through problems &amp; fixes
        </Link>
        .
      </p>
    </main>
  );
}
