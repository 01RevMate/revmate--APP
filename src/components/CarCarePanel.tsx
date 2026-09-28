import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarPlus, ClipboardCheck, ExternalLink, Landmark } from "lucide-react";
import { toast } from "sonner";
import {
  dueState,
  dueText,
  GOV_LINKS,
  reminderCalendarFile,
  saveCarDates,
  type DueState,
} from "@/lib/carCare";

const TONES: Record<DueState, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  soon: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  urgent: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  overdue: "bg-red-500/15 text-red-700 dark:text-red-300",
};

/**
 * MOT and road tax for one of the owner's cars: when they're due, a
 * reminder 30, 7 and 1 day before, handy GOV.UK links and add-to-calendar.
 */
export function CarCarePanel({
  car,
}: {
  car: {
    id: string;
    nickname: string;
    make: string;
    model: string;
    mot_due?: string | null;
    tax_due?: string | null;
    reminders_enabled?: boolean;
  };
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const name = car.nickname || `${car.make} ${car.model}`;

  async function save(fields: Parameters<typeof saveCarDates>[1], message: string) {
    setSaving(true);
    try {
      await saveCarDates(car.id, fields);
      await queryClient.invalidateQueries();
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  const rows = [
    {
      key: "mot_due" as const,
      label: "MOT",
      icon: ClipboardCheck,
      value: car.mot_due ?? null,
      links: [
        { href: GOV_LINKS.motHistory, text: "MOT history" },
        { href: GOV_LINKS.bookMot, text: "Book an MOT" },
      ],
    },
    {
      key: "tax_due" as const,
      label: "Road tax",
      icon: Landmark,
      value: car.tax_due ?? null,
      links: [
        { href: GOV_LINKS.checkTax, text: "Check tax" },
        { href: GOV_LINKS.taxCar, text: "Tax your car" },
      ],
    },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Car care</h2>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={car.reminders_enabled ?? true}
            disabled={saving}
            onChange={(e) =>
              void save(
                { reminders_enabled: e.target.checked },
                e.target.checked ? "Reminders on." : "Reminders off.",
              )
            }
            className="accent-primary"
          />
          <BellRing className="size-3.5" /> Reminders
        </label>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        We'll remind you 30, 7 and 1 day before anything's due.
      </p>
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li key={row.key} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <row.icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
              <span className="text-sm font-semibold">{row.label}</span>
              {row.value && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[dueState(row.value)]}`}
                >
                  {dueText(row.value)}
                </span>
              )}
              <input
                type="date"
                aria-label={`${row.label} due date`}
                value={row.value ?? ""}
                disabled={saving}
                onChange={(e) =>
                  void save({ [row.key]: e.target.value || null }, `${row.label} date saved.`)
                }
                className="ml-auto rounded-md border border-input bg-background px-2 py-1 text-sm"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {row.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {link.text} <ExternalLink className="size-3" />
                </a>
              ))}
              {row.value && (
                <a
                  href={reminderCalendarFile(`${name} ${row.label} due`, row.value)}
                  download={`${row.label.toLowerCase().replace(/ /g, "-")}-due.ics`}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <CalendarPlus className="size-3" /> Add to calendar
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!car.mot_due && !car.tax_due && (
        <p className="mt-3 text-xs text-muted-foreground">
          Not sure of the dates? Check your MOT history and tax on GOV.UK with your registration,
          then add them here.
        </p>
      )}
    </section>
  );
}

/** One-line summary of what's due soon across someone's cars. */
export function upcomingCare(
  cars: {
    id: string;
    nickname: string;
    make: string;
    model: string;
    mot_due?: string | null;
    tax_due?: string | null;
  }[],
) {
  return cars
    .flatMap((car) =>
      (["mot_due", "tax_due"] as const)
        .filter((key) => car[key] && dueState(car[key]!) !== "ok")
        .map((key) => ({
          car,
          label: key === "mot_due" ? "MOT" : "Road tax",
          date: car[key]!,
          state: dueState(car[key]!),
        })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
