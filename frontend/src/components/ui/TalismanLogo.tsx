import { cn } from '@/lib/utils';

interface TalismanLogoProps {
  className?: string;
}

/**
 * Talisman IO compass rose logo.
 * Metallic compass points with gold gem accent at center.
 * Works at 24px, 32px, 48px, 128px+.
 */
export const TalismanLogo = ({ className }: TalismanLogoProps) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn('shrink-0', className)}
  >
    {/* Outer ring */}
    <circle cx="32" cy="32" r="30" stroke="url(#metalRing)" strokeWidth="1.5" opacity="0.4" />

    {/* Cardinal compass points — N, S, E, W */}
    {/* North */}
    <path d="M32 4L37 20H27L32 4Z" fill="url(#metalGrad)" />
    {/* South */}
    <path d="M32 60L27 44H37L32 60Z" fill="url(#metalGrad)" />
    {/* East */}
    <path d="M60 32L44 37V27L60 32Z" fill="url(#metalGrad)" />
    {/* West */}
    <path d="M4 32L20 27V37L4 32Z" fill="url(#metalGrad)" />

    {/* Intercardinal points — NE, SE, SW, NW (smaller) */}
    {/* NE */}
    <path d="M49.5 14.5L42 24L38 20L49.5 14.5Z" fill="url(#metalGradLight)" opacity="0.7" />
    {/* SE */}
    <path d="M49.5 49.5L38 44L42 40L49.5 49.5Z" fill="url(#metalGradLight)" opacity="0.7" />
    {/* SW */}
    <path d="M14.5 49.5L22 40L26 44L14.5 49.5Z" fill="url(#metalGradLight)" opacity="0.7" />
    {/* NW */}
    <path d="M14.5 14.5L26 20L22 24L14.5 14.5Z" fill="url(#metalGradLight)" opacity="0.7" />

    {/* Inner decorative ring */}
    <circle cx="32" cy="32" r="12" stroke="url(#metalRing)" strokeWidth="1" opacity="0.3" />

    {/* Gold gem center */}
    <circle cx="32" cy="32" r="5" fill="url(#gemGrad)" />
    <circle cx="32" cy="32" r="5" fill="url(#gemShine)" />

    {/* Gem highlight */}
    <ellipse cx="30.5" cy="30" rx="2" ry="1.5" fill="white" opacity="0.3" />

    <defs>
      {/* Gold metallic gradient for main points */}
      <linearGradient id="metalGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F0D060" />
        <stop offset="40%" stopColor="#D4AF37" />
        <stop offset="100%" stopColor="#8A7025" />
      </linearGradient>

      {/* Lighter gold for intercardinal points */}
      <linearGradient id="metalGradLight" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#E8C94A" />
        <stop offset="100%" stopColor="#B89530" />
      </linearGradient>

      {/* Ring gradient */}
      <linearGradient id="metalRing" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#D4AF37" />
        <stop offset="100%" stopColor="#8A7025" />
      </linearGradient>

      {/* Gold gem gradient */}
      <radialGradient id="gemGrad" cx="0.4" cy="0.35" r="0.6">
        <stop offset="0%" stopColor="hsl(43, 80%, 65%)" />
        <stop offset="60%" stopColor="hsl(43, 70%, 50%)" />
        <stop offset="100%" stopColor="hsl(43, 60%, 35%)" />
      </radialGradient>

      {/* Gem shine overlay */}
      <radialGradient id="gemShine" cx="0.35" cy="0.3" r="0.5">
        <stop offset="0%" stopColor="white" stopOpacity="0.25" />
        <stop offset="100%" stopColor="transparent" stopOpacity="0" />
      </radialGradient>
    </defs>
  </svg>
);
