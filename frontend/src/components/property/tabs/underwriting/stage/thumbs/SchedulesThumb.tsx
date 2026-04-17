export function SchedulesThumb() {
  // Three stacked mini-tables, each with a header bar + 3 rows.
  const tables = [8, 32, 56];
  return (
    <svg
      viewBox="0 0 120 84"
      preserveAspectRatio="none"
      className="h-full w-full block"
    >
      <rect width="120" height="84" fill="hsl(var(--background))" />

      {tables.map((y) => (
        <g key={y}>
          <rect x="8" y={y} width="104" height="5" rx="1" fill="#ffffff" opacity="0.16" />
          <rect x="8" y={y + 7} width="104" height="3" rx="0.5" fill="#ffffff" opacity="0.08" />
          <rect x="8" y={y + 12} width="104" height="3" rx="0.5" fill="#ffffff" opacity="0.08" />
          <rect x="8" y={y + 17} width="104" height="3" rx="0.5" fill="#ffffff" opacity="0.08" />
        </g>
      ))}
    </svg>
  );
}
