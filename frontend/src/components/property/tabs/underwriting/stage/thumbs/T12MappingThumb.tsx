export function T12MappingThumb() {
  // Two columns with connector lines suggesting column mapping between
  // uploaded T12 headers and taxonomy targets.
  const rows = [16, 28, 40, 52, 64];
  return (
    <svg
      viewBox="0 0 120 84"
      preserveAspectRatio="none"
      className="h-full w-full block"
    >
      <rect width="120" height="84" fill="hsl(var(--background))" />

      {/* Left column header */}
      <rect x="8" y="8" width="40" height="5" rx="1" fill="#ffffff" opacity="0.16" />
      {/* Right column header */}
      <rect x="72" y="8" width="40" height="5" rx="1" fill="#ffffff" opacity="0.16" />

      {rows.map((y) => (
        <g key={y}>
          <rect x="8" y={y} width="40" height="6" rx="1" fill="#ffffff" opacity="0.08" />
          <rect x="72" y={y} width="40" height="6" rx="1" fill="#ffffff" opacity="0.08" />
          {/* connector */}
          <rect x="48" y={y + 2.5} width="24" height="1" fill="#ffffff" opacity="0.16" />
        </g>
      ))}
    </svg>
  );
}
