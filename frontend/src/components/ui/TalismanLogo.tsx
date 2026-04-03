import { cn } from '@/lib/utils';

interface TalismanLogoProps {
  className?: string;
  size?: number;
}

/**
 * Talisman IO compass logo — B&W silver metallic with blue gem.
 * Matches the landing page icon.
 */
export const TalismanLogo = ({ className, size }: TalismanLogoProps) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn('shrink-0', className)}
    width={size}
    height={size}
  >
    {/* Cardinal points */}
    <path d="M32 8L36 21H28L32 8Z" fill="url(#tl-mg)" />
    <path d="M32 56L28 43H36L32 56Z" fill="url(#tl-mg)" />
    <path d="M56 32L43 36V28L56 32Z" fill="url(#tl-mg)" />
    <path d="M8 32L21 28V36L8 32Z" fill="url(#tl-mg)" />

    {/* Intercardinal points */}
    <path d="M48 16L42 24L38 20L48 16Z" fill="#B8B8C8" opacity="0.6" />
    <path d="M48 48L38 42L42 38L48 48Z" fill="#B8B8C8" opacity="0.6" />
    <path d="M16 48L22 38L26 42L16 48Z" fill="#B8B8C8" opacity="0.6" />
    <path d="M16 16L26 22L22 26L16 16Z" fill="#B8B8C8" opacity="0.6" />

    {/* Inner ring */}
    <circle cx="32" cy="32" r="11" stroke="#9090A0" strokeWidth="0.8" opacity="0.3" />

    {/* Blue gem center */}
    <circle cx="32" cy="32" r="5.5" fill="url(#tl-gem)" />
    <ellipse cx="30.5" cy="30" rx="2" ry="1.5" fill="white" opacity="0.25" />

    <defs>
      <linearGradient id="tl-mg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#E8E8EE" />
        <stop offset="50%" stopColor="#B8B8C8" />
        <stop offset="100%" stopColor="#7A7A8E" />
      </linearGradient>
      <radialGradient id="tl-gem" cx="0.4" cy="0.35" r="0.6">
        <stop offset="0%" stopColor="hsl(210,80%,65%)" />
        <stop offset="60%" stopColor="hsl(210,70%,50%)" />
        <stop offset="100%" stopColor="hsl(210,60%,35%)" />
      </radialGradient>
    </defs>
  </svg>
);
