export function SummaryThumb() {
  return (
    <svg
      viewBox="0 0 120 84"
      preserveAspectRatio="none"
      className="h-full w-full block"
    >
      <rect width="120" height="84" fill="hsl(var(--background))" />

      {/* 2x2 KPI grid */}
      <rect x="8" y="8" width="48" height="18" rx="2" fill="#ffffff" opacity="0.08" />
      <rect x="64" y="8" width="48" height="18" rx="2" fill="#ffffff" opacity="0.08" />
      <rect x="8" y="30" width="48" height="18" rx="2" fill="#ffffff" opacity="0.08" />
      <rect x="64" y="30" width="48" height="18" rx="2" fill="#ffffff" opacity="0.08" />

      {/* Chart row */}
      <rect x="8" y="54" width="104" height="22" rx="2" fill="#ffffff" opacity="0.04" />
      <rect x="16" y="68" width="6" height="6" fill="#ffffff" opacity="0.24" />
      <rect x="28" y="64" width="6" height="10" fill="#ffffff" opacity="0.24" />
      <rect x="40" y="62" width="6" height="12" fill="#ffffff" opacity="0.24" />
      <rect x="52" y="60" width="6" height="14" fill="#ffffff" opacity="0.24" />
      <rect x="64" y="58" width="6" height="16" fill="#ffffff" opacity="0.24" />
      <rect x="76" y="56" width="6" height="18" fill="#ffffff" opacity="0.24" />
      <rect x="88" y="60" width="6" height="14" fill="#ffffff" opacity="0.24" />
      <rect x="100" y="58" width="6" height="16" fill="#ffffff" opacity="0.24" />
    </svg>
  );
}
