import logo from "@/assets/lendawatt-logo.jpg.asset.json";
/** The full Community Charger logo image (used everywhere except the menus). */
export function CommunityChargerLogo({ className = "" }: { className?: string }) {
  return <img src={logo.url} alt="Lendawatt Community Charger" width={1088} height={1088} className={`rounded-xl object-cover ${className}`} />;
}
