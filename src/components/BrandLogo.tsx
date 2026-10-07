import lightLogo from "@/assets/revmate-logo-light.png.asset.json";
import { cn } from "@/lib/utils";

/** The RevMate logo: the usual one by day, the white one in night mode. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <img
        src={lightLogo.url}
        alt="RevMate"
        className={cn("block object-contain dark:hidden", className)}
      />
      <img
        src="/brand/revmate-logo-dark.png"
        alt="RevMate"
        className={cn("hidden object-contain dark:block", className)}
      />
    </>
  );
}
