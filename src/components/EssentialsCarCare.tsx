import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { fetchGarage } from "@/lib/garage";
import { dueState, dueText, type DueState } from "@/lib/carCare";
import { displayUsernameWithoutAt } from "@/lib/usernames";

const TONES: Record<DueState, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  soon: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  urgent: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  overdue: "bg-red-500/15 text-red-700 dark:text-red-300",
};

/** MOT and tax status for each of your cars, on the Essentials home. */
export function EssentialsCarCare() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: garage } = useQuery({
    queryKey: ["garage", user?.id],
    enabled: !!user,
    queryFn: () => fetchGarage(user!.id),
  });
  const cars = (garage ?? []).filter((car) => car.ownership_status !== "previous");
  if (!user || !profile) return null;

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
        <CalendarCheck className="size-4 text-primary" /> MOT &amp; tax
      </h2>
      {cars.length === 0 ? (
        <Link
          to="/garage"
          className="block rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground"
        >
          Add your car to get MOT and road tax reminders →
        </Link>
      ) : (
        <ul className="space-y-2">
          {cars.map((car) => (
            <li key={car.id}>
              <Link
                to="/u/$username/cars/$carId"
                params={{ username: displayUsernameWithoutAt(profile.username), carId: car.id }}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm hover:bg-accent/50"
              >
                <span className="mr-auto font-medium">
                  {car.nickname || `${car.make} ${car.model}`}
                </span>
                {car.mot_due ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[dueState(car.mot_due)]}`}
                  >
                    MOT · {dueText(car.mot_due)}
                  </span>
                ) : null}
                {car.tax_due ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[dueState(car.tax_due)]}`}
                  >
                    Tax · {dueText(car.tax_due)}
                  </span>
                ) : null}
                {!car.mot_due && !car.tax_due && (
                  <span className="text-xs text-primary">Add MOT &amp; tax dates →</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
