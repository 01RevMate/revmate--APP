import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { carLabel, carPath, fetchCars, setCarStatus, yearRange } from "@/lib/cars";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — RevMate" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading, isAdmin } = useProfile();
  const queryClient = useQueryClient();

  const { data: cars, isLoading: carsLoading } = useQuery({
    queryKey: ["cars", ""],
    queryFn: () => fetchCars(),
    enabled: isAdmin,
  });

  async function toggleStatus(carId: string, current: "verified" | "unverified") {
    const next = current === "verified" ? "unverified" : "verified";
    try {
      await setCarStatus(carId, next);
      queryClient.invalidateQueries({ queryKey: ["cars"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update car");
    }
  }

  if (authLoading || profileLoading) {
    return <p className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          <Link to="/login" className="underline">
            Log in
          </Link>{" "}
          with an admin account to continue.
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {profile?.username ?? user.email} doesn't have admin access.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">Verify or unverify car pages.</p>

      {carsLoading && <p className="mt-6 text-sm text-muted-foreground">Loading cars…</p>}

      <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
        {cars?.map((car) => (
          <li key={car.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <Link {...carPath(car)} className="font-medium hover:underline">
                {carLabel(car)}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {yearRange(car)} · {car.body_type ?? "—"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                  car.status === "verified"
                    ? "border-transparent bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {car.status === "verified" ? "Verified" : "Unverified"}
              </span>
              <button
                onClick={() => toggleStatus(car.id, car.status)}
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                {car.status === "verified" ? "Mark unverified" : "Mark verified"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
