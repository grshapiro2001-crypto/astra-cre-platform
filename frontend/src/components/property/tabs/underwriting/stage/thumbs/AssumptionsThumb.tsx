export function AssumptionsThumb() {
  const rows = [12, 22, 32, 42, 52, 62];
  return (
    <svg
      viewBox="0 0 120 84"
      preserveAspectRatio="none"
      className="h-full w-full block"
    >
      <rect width="120" height="84" fill="hsl(var(--background))" />

      {/* Left gutter label strip */}
      <rect x="0" y="0" width="8" height="84" fill="#ffffff" opacity="0.04" />

      {/* Form rows: short label + wide input */}
      {rows.map((y) => (
        <g key={y}>
          <rect x="12" y={y - 2} width="22" height="6" rx="1" fill="#ffffff" opacity="0.16" />
          <rect x="38" y={y - 3} width="74" height="8" rx="1.5" fill="#ffffff" opacity="0.08" />
        </g>
      ))}
    </svg>
  );
}
