import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TopSearch() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  return (
    <form
      role="search"
      className="order-last flex h-11 w-full items-center gap-2 rounded-full bg-muted px-3 focus-within:ring-2 focus-within:ring-ring md:order-none md:ml-4 md:max-w-lg md:flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        void navigate({ to: "/search", search: query.trim() ? { q: query.trim().slice(0, 100) } : {} });
      }}
    >
      <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search RevMate"
        placeholder="Search RevMate…"
        enterKeyHint="search"
        maxLength={100}
        className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
      />
      <Button type="submit" variant="ghost" size="icon" className="size-8 shrink-0 rounded-full" aria-label="Search" title="Search">
        <ArrowUpRight />
      </Button>
    </form>
  );
}