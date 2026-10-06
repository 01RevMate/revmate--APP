import { useEffect, useState, type ReactNode } from "react";
import { Navigation } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

type NavApp = "google" | "apple" | "waze";

const APPS: { id: NavApp; label: string; colour: string; mark: string }[] = [
  { id: "google", label: "Google Maps", colour: "bg-[#1a73e8]", mark: "G" },
  { id: "apple", label: "Apple Maps", colour: "bg-[#34c759]", mark: "" },
  { id: "waze", label: "Waze", colour: "bg-[#33ccff]", mark: "W" },
];

const LAST_APP_KEY = "revmate:navApp";

/** Turn-by-turn directions links; on phones these open the app if it's installed. */
function directionsUrl(app: NavApp, lat: number, lng: number) {
  const dest = `${lat},${lng}`;
  if (app === "apple") return `https://maps.apple.com/?daddr=${dest}&dirflg=d`;
  if (app === "waze") return `https://waze.com/ul?ll=${dest}&navigate=yes`;
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

/**
 * A Directions button that asks which app to use — Google Maps, Apple Maps or
 * Waze — with the one you used last at the top.
 */
export function DirectionsButton({
  lat,
  lng,
  name,
  variant = "full",
}: {
  lat: number;
  lng: number;
  name: string;
  /** "full": big button; "icon": small round button for list rows. */
  variant?: "full" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<NavApp | null>(null);

  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(LAST_APP_KEY);
      if (saved === "google" || saved === "apple" || saved === "waze") setLast(saved);
    } catch {
      // Storage blocked: no "last used", that's all.
    }
  }, [open]);

  function remember(app: NavApp) {
    try {
      localStorage.setItem(LAST_APP_KEY, app);
    } catch {
      // Not remembered this time; fine.
    }
    setOpen(false);
  }

  const ordered = last
    ? [...APPS].sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : 0))
    : APPS;

  let trigger: ReactNode;
  if (variant === "icon") {
    trigger = (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Directions to ${name}`}
        className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <Navigation className="size-4" />
      </button>
    );
  } else {
    trigger = (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground"
      >
        <Navigation className="size-5" /> Directions
      </button>
    );
  }

  return (
    <>
      {trigger}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Directions</DrawerTitle>
            <DrawerDescription className="truncate">To {name}</DrawerDescription>
          </DrawerHeader>
          <ul className="space-y-2 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {ordered.map((app) => (
              <li key={app.id}>
                <a
                  href={directionsUrl(app.id, lat, lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => remember(app.id)}
                  className="flex min-h-14 items-center gap-3 rounded-2xl bg-muted px-3 text-[15px] font-semibold active:bg-accent"
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-base font-extrabold text-white ${app.colour}`}
                  >
                    {app.mark || <Navigation className="size-4" />}
                  </span>
                  <span className="flex-1">{app.label}</span>
                  {app.id === last && (
                    <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      Last used
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </DrawerContent>
      </Drawer>
    </>
  );
}
