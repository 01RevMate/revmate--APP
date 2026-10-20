import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ShopForm } from "@/components/ShopForm";
import { applyForShop, fetchMyShops } from "@/lib/shops";

export const Route = createFileRoute("/shops/new")({
  head: () => ({
    meta: [{ title: "List your shop — RevMate" }, { name: "robots", content: "noindex" }],
  }),
  component: NewShopPage,
});

function NewShopPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const { data: mine } = useQuery({
    queryKey: ["shops", "mine", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyShops(user!.id),
    retry: false,
  });

  if (loading) return <main className="min-h-[60vh]" />;
  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-center">
        <h1 className="text-2xl font-extrabold">List your shop</h1>
        <p className="mt-2 text-sm text-muted-foreground">Log in or join free to list your shop.</p>
        <Link
          to="/login"
          search={{ redirect: "/shops/new" }}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
        >
          Log in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-12 pt-6">
      <h1 className="text-2xl font-extrabold tracking-tight">List your shop</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Free for brands, parts sellers and small makers. We check every shop before it goes live
        (usually within a couple of days). People buy on your own website.
      </p>

      {(mine?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-2xl border border-border p-3 text-sm">
          <p className="font-semibold">Your shops</p>
          <ul className="mt-1 space-y-1">
            {mine!.map((s) => (
              <li key={s.id}>
                <Link
                  to="/shops/$slug"
                  params={{ slug: s.slug }}
                  className="text-primary underline"
                >
                  {s.name}
                </Link>{" "}
                <span className="text-muted-foreground">
                  ·{" "}
                  {s.status === "pending"
                    ? "waiting for approval"
                    : s.status === "active"
                      ? "live"
                      : "not approved"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <ShopForm
          submitLabel="Send for approval"
          saving={saving}
          onSubmit={async (input) => {
            setSaving(true);
            try {
              const slug = await applyForShop(input);
              toast.success("Thanks! We'll check your shop and put it live soon.");
              void navigate({ to: "/shops/$slug", params: { slug } });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Couldn't send it");
            } finally {
              setSaving(false);
            }
          }}
        />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        By listing you confirm you can legally sell what you list, that it's safe and road-legal
        where it needs to be, and that your shop follows our{" "}
        <Link to="/community-standards" className="underline">
          community standards
        </Link>
        .
      </p>
    </main>
  );
}
