import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { setHomeMode } from "@/hooks/useHomeMode";

// Essentials lives on Home (the Community / Essentials switch). This address
// is kept for the menu and old links: it flips Home to Essentials and goes
// there.
export const Route = createFileRoute("/essentials")({
  head: () => ({
    meta: [{ title: "Essentials — RevMate" }, { name: "robots", content: "noindex, follow" }],
  }),
  component: EssentialsRedirect,
});

function EssentialsRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    setHomeMode("essentials");
    void navigate({ to: "/", replace: true });
  }, [navigate]);
  return null;
}
