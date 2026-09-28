import { createFileRoute } from "@tanstack/react-router";
import { EssentialsHome } from "@/components/EssentialsHome";

export const Route = createFileRoute("/essentials")({
  head: () => ({
    meta: [
      { title: "Essentials — RevMate" },
      {
        name: "description",
        content: "Buy and sell cars and parts, get help with faults and research cars on RevMate.",
      },
      { property: "og:title", content: "Essentials — RevMate" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EssentialsPage,
});

function EssentialsPage() {
  return (
    <main className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-6">
      <EssentialsHome />
    </main>
  );
}
