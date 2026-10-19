import { createFileRoute } from "@tanstack/react-router";
import { looseDb } from "@/lib/looseDb";

// Digital Asset Links for the Google Play version of RevMate (a Trusted Web
// Activity). With a match here, the Play app opens full-screen with no
// browser bar. The package name and signing fingerprint are set in
// Admin → Marketing; until then this returns an empty list.
export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: async () => {
        let statements: unknown[] = [];
        try {
          const { data } = await looseDb
            .from("app_settings")
            .select("key, value")
            .in("key", ["android_package", "android_fingerprint"]);
          const map = new Map(
            ((data as { key: string; value: string }[] | null) ?? []).map((r) => [r.key, r.value]),
          );
          const pkg = map.get("android_package") ?? "";
          const fingerprint = map.get("android_fingerprint") ?? "";
          if (pkg && fingerprint) {
            statements = [
              {
                relation: ["delegate_permission/common.handle_all_urls"],
                target: {
                  namespace: "android_app",
                  package_name: pkg,
                  sha256_cert_fingerprints: [fingerprint],
                },
              },
            ];
          }
        } catch {
          // Settings table not there yet: nothing to declare.
        }
        return new Response(JSON.stringify(statements), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
