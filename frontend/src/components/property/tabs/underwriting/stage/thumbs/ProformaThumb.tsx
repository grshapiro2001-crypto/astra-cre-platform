export function ProformaThumb() {
  const cols = [12, 32, 52, 72, 92];
  const rows = [22, 32, 42, 52, 62, 72];
  return (
    <svg
      viewBox="0 0 120 84"
      preserveAspectRatio="none"
      className="h-full w-full block"
    >
      <rect width="120" height="84" fill="hsl(var(--background))" />

      {/* Header row */}
      <rect x="8" y="10" width="104" height="6" rx="1" fill="#ffffff" opacity="0.16" />

      {/* 5 col x 6 row grid */}
      {rows.map((y, ri) =>
        cols.map((x, ci) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={ci === 0 ? 16 : 16}
            height="6"
            rx="1"
            fill="#ffffff"
            opacity={ci === 0 ? 0.16 : ri % 2 === 0 ? 0.08 : 0.04}
          />
        )),
      )}
    </svg>
  );
}
