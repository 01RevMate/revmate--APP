import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/PageSkeletons";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Show a skeleton, not a blank screen, when a page is slow to load — but
    // only after 300ms so quick navigations never flash one, and then hold it
    // briefly so it doesn't flicker away.
    defaultPendingComponent: PageSkeleton,
    defaultPendingMs: 300,
    defaultPendingMinMs: 400,
  });

  return router;
};
