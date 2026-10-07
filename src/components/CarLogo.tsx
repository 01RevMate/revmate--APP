import { getCarLogoUrl } from "@/lib/carLogos";

/**
 * A car brand's logo in a small white circle, so dark logos (Audi, Mercedes,
 * Toyota…) still show up in night mode and on photos. `bare` drops the
 * circle, e.g. for the big white logo printed on a group's cover.
 */
export function CarLogo({
  make,
  className = "size-6",
  bare = false,
}: {
  make: string | null | undefined;
  className?: string;
  bare?: boolean;
}) {
  const url = getCarLogoUrl(make);
  if (!url) return null;
  if (bare) {
    return (
      <img src={url} alt={`${make} logo`} className={`${className} shrink-0 object-contain`} />
    );
  }
  return (
    <span
      className={`${className} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/10`}
    >
      <img src={url} alt={`${make} logo`} className="size-[72%] object-contain" />
    </span>
  );
}
