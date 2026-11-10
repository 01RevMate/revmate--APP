import { Zap } from "lucide-react";

export function ChargeRadar({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-5 py-8">
      <div className="relative size-40">
        {[0, 1, 2].map((i) => (
          <span key={i} className="lw-radar-ring absolute inset-0 rounded-full border-2 border-primary" style={{ animationDelay: `${i * 0.7}s` }} />
        ))}
        <span className="absolute inset-0 rounded-full border border-primary/30" />
        <span className="absolute inset-6 rounded-full border border-primary/20" />
        <span className="lw-radar-sweep absolute inset-0 rounded-full" />
        <span className="lw-radar-dot absolute left-[22%] top-[30%] size-2 rounded-full bg-primary" style={{ animationDelay: "0.4s" }} />
        <span className="lw-radar-dot absolute right-[20%] top-[55%] size-2 rounded-full bg-primary" style={{ animationDelay: "1.2s" }} />
        <span className="lw-radar-dot absolute bottom-[18%] left-[42%] size-2 rounded-full bg-primary" style={{ animationDelay: "1.9s" }} />
        <span className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_24px_var(--primary)]">
          <Zap className="size-6 animate-pulse" />
        </span>
      </div>
      <p className="text-base font-semibold text-foreground">{label}</p>
    </div>
  );
}
