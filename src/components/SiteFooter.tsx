import { Link } from "@tanstack/react-router";

// Plain links to every public part of RevMate. Helps people (and Google)
// find their way around, especially when they land on a page from search.
const COLUMNS: {
  title: string;
  links: { label: string; to: string; search?: Record<string, string> }[];
}[] = [
  {
    title: "Buy & sell",
    links: [
      { label: "Used cars for sale", to: "/marketplace", search: { type: "car" } },
      { label: "Car parts & accessories", to: "/marketplace", search: { type: "part" } },
      { label: "Sell your car", to: "/sell" },
      { label: "Local garages & businesses", to: "/businesses" },
    ],
  },
  {
    title: "Your car",
    links: [
      { label: "Car specs & common faults", to: "/cars" },
      { label: "Car problems & fixes", to: "/issues" },
      { label: "Car meets & events", to: "/meets" },
      { label: "Car clubs & groups", to: "/groups" },
    ],
  },
  {
    title: "RevMate",
    links: [
      { label: "Join free", to: "/signup" },
      { label: "Safety tips", to: "/legal/safety" },
      { label: "Community standards", to: "/community-standards" },
      { label: "App updates", to: "/legal/updates" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/30 px-4 pb-24 pt-8 text-sm md:pb-8">
      <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="mb-2 font-semibold">{column.title}</p>
            <ul className="space-y-1.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    search={link.search ?? {}}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-6 flex max-w-5xl flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} RevMate · UK car community, garage & marketplace</span>
        <Link to="/legal/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        <Link to="/legal/terms" className="hover:text-foreground">
          Terms
        </Link>
        <Link to="/legal/cookies" className="hover:text-foreground">
          Cookies
        </Link>
      </div>
    </footer>
  );
}
