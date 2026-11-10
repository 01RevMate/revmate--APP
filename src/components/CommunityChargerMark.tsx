/** Simple one-colour Community Charger mark (plug inside a heart). Uses currentColor. */
export function CommunityChargerMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M24 41s-15-8.6-15-20.2A8.3 8.3 0 0 1 24 15.6a8.3 8.3 0 0 1 15 5.2C39 32.4 24 41 24 41Z" />
      <path d="M26.5 19.5 20.5 28h7l-6 8.5" />
    </svg>
  );
}
