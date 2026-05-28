export function PartnershipReturnsThumb() {
  return (
    <svg
      viewBox="0 0 120 84"
      preserveAspectRatio="none"
      className="h-full w-full block"
    >
      <rect width="120" height="84" fill="hsl(var(--background))" />

      {/* KPI row */}
      <rect x="8" y="8" width="24" height="16" rx="2" fill="#ffffff" opacity="0.08" />
      <rect x="36" y="8" width="24" height="16" rx="2" fill="#ffffff" opacity="0.08" />
      <rect x="64" y="8" width="24" height="16" rx="2" fill="#ffffff" opacity="0.08" />
      <rect x="92" y="8" width="20" height="16" rx="2" fill="#ffffff" opacity="0.08" />

      {/* Distribution schedule table rows */}
      <rect x="8" y="32" width="104" height="8" rx="1" fill="#ffffff" opacity="0.05" />
      <rect x="8" y="44" width="104" height="6" rx="1" fill="#ffffff" opacity="0.04" />
      <rect x="8" y="54" width="104" height="6" rx="1" fill="#ffffff" opacity="0.04" />
      <rect x="8" y="64" width="104" height="6" rx="1" fill="#ffffff" opacity="0.04" />
      <rect x="8" y="74" width="72" height="6" rx="1" fill="#ffffff" opacity="0.04" />
    </svg>
  );
}
