export function CashFlowsThumb() {
  const ticks = [12, 24, 36, 48, 60, 72, 84, 96];
  const bars = [
    { x: 12, h: 18 },
    { x: 24, h: 26 },
    { x: 36, h: 32 },
    { x: 48, h: 38 },
    { x: 60, h: 34 },
    { x: 72, h: 40 },
    { x: 84, h: 44 },
    { x: 96, h: 48 },
  ];
  return (
    <svg
      viewBox="0 0 120 84"
      preserveAspectRatio="none"
      className="h-full w-full block"
    >
      <rect width="120" height="84" fill="hsl(var(--background))" />

      {/* Top timeline ticks */}
      {ticks.map((x) => (
        <rect key={x} x={x} y="10" width="8" height="3" rx="0.5" fill="#ffffff" opacity="0.16" />
      ))}

      {/* Vertical bar waterfall */}
      {bars.map((b) => (
        <rect
          key={b.x}
          x={b.x}
          y={74 - b.h}
          width="8"
          height={b.h}
          rx="1"
          fill="#ffffff"
          opacity="0.24"
        />
      ))}
    </svg>
  );
}
