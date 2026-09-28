import { useEffect, useState } from "react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Day / month / year pickers, as on Facebook and TikTok. Calls onChange with
 * an ISO date (YYYY-MM-DD), or null while incomplete or impossible (31 Feb).
 */
export function BirthDateSelect({ onChange }: { onChange: (isoDate: string | null) => void }) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const thisYear = new Date().getFullYear();
  const complete = !!(day && month && year);
  const iso = complete ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : null;
  const valid = iso ? new Date(`${iso}T12:00:00`).getDate() === Number(day) : false;

  useEffect(() => {
    onChange(valid ? iso : null);
  }, [iso, valid, onChange]);

  const input = "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm";
  return (
    <div>
      <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
        <select
          aria-label="Day"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className={input}
        >
          <option value="">Day</option>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              {i + 1}
            </option>
          ))}
        </select>
        <select
          aria-label="Month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={input}
        >
          <option value="">Month</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={String(i + 1)}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Year"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className={input}
        >
          <option value="">Year</option>
          {Array.from({ length: 110 }, (_, i) => thisYear - i).map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {complete && !valid && (
        <p className="mt-1 text-xs text-destructive">That date doesn't exist.</p>
      )}
    </div>
  );
}
