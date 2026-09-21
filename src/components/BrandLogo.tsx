import lightLogo from "@/assets/revmate-logo-light.png.asset.json";
import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src={lightLogo.url}
      alt="RevMate"
      className={cn("block object-contain", className)}
    />
  );
}