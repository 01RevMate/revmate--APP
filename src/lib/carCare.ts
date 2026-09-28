import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// MOT and tax reminders (0045_car_care_diagnostics_feed.sql).

export const GOV_LINKS = {
  motHistory: "https://www.gov.uk/check-mot-history",
  bookMot: "https://www.gov.uk/getting-an-mot",
  taxCar: "https://www.gov.uk/vehicle-tax",
  checkTax: "https://www.gov.uk/check-vehicle-tax",
};

/** True once 0045 has been applied. */
export function useCarCareFeature(): boolean {
  const { data } = useQuery({
    queryKey: ["feature", "car-care"],
    queryFn: async () => !(await supabase.from("garage_cars").select("mot_due").limit(1)).error,
    staleTime: Infinity,
    retry: false,
  });
  return data === true;
}

export function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const due = new Date(`${isoDate}T12:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export type DueState = "ok" | "soon" | "urgent" | "overdue";

export function dueState(isoDate: string): DueState {
  const days = daysUntil(isoDate);
  if (days < 0) return "overdue";
  if (days <= 7) return "urgent";
  if (days <= 30) return "soon";
  return "ok";
}

export function dueText(isoDate: string): string {
  const days = daysUntil(isoDate);
  if (days < 0) return `Overdue by ${-days} day${days === -1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 60) return `Due in ${days} days`;
  return `Due ${new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

export async function saveCarDates(
  garageCarId: string,
  fields: { mot_due?: string | null; tax_due?: string | null; reminders_enabled?: boolean },
) {
  const { error } = await supabase.from("garage_cars").update(fields).eq("id", garageCarId);
  if (error) throw error;
}

/** An all-day calendar event, so the date sits in the phone's calendar too. */
export function reminderCalendarFile(title: string, isoDate: string): string {
  const day = isoDate.replace(/-/g, "");
  const next = new Date(`${isoDate}T12:00:00`);
  next.setDate(next.getDate() + 1);
  const end = next.toISOString().slice(0, 10).replace(/-/g, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RevMate//Car reminders//EN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@revmate`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${title.replace(/[,;\\]/g, " ")}`,
    "BEGIN:VALARM",
    "TRIGGER:-P7D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${title.replace(/[,;\\]/g, " ")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}
