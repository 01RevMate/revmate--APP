import { getCarLogoUrl } from "@/lib/carLogos";

export function CarLogo({
  make,
  className = "size-6",
}: {
  make: string | null | undefined;
  className?: string;
}) {
  const url = getCarLogoUrl(make);
  if (!url) return null;
  return <img src={url} alt={`${make} logo`} className={`${className} shrink-0 object-contain`} />;
}
