import { useEffect, useState } from "react";

/** Short brand intro shown once per visit to the Lendawatt page: "L" → "Lend · a · watt". */
export function LendawattIntro() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem("lw-intro")) return;
    sessionStorage.setItem("lw-intro", "1");
    setShow(true);
    const t = setTimeout(() => setShow(false), 2200);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div
      role="presentation"
      onClick={() => setShow(false)}
      className="lw-intro fixed inset-0 z-[60] flex items-center justify-center bg-background"
    >
      <p className="flex items-baseline text-5xl font-extrabold tracking-tight sm:text-7xl">
        <span className="lw-l text-primary">L</span>
        <span className="lw-word" style={{ animationDelay: "350ms" }}>end</span>
        <span className="lw-word mx-1 text-muted-foreground" style={{ animationDelay: "700ms" }}>a</span>
        <span className="lw-word text-primary" style={{ animationDelay: "1000ms" }}>watt</span>
        <span className="lw-word" style={{ animationDelay: "1300ms" }}>⚡</span>
      </p>
    </div>
  );
}
