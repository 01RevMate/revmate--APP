/** The full Community Charger logo image (used everywhere except the menus). */
export function CommunityChargerLogo({ className = "" }: { className?: string }) {
  return <img src="/community-charger-logo.jpg" alt="Community Charger" width={1088} height={1088} className={`rounded-xl object-cover ${className}`} />;
}
