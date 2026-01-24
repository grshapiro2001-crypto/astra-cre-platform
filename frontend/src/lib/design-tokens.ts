/**
 * Emerald Forest Design System - Design Tokens
 *
 * Centralized design tokens for the CRE Platform.
 * Use these tokens for consistent theming across all components.
 */

export const tokens = {
  colors: {
    // Semantic colors (resolved via CSS variables)
    primary: "hsl(var(--primary))",
    secondary: "hsl(var(--secondary))",
    accent: "hsl(var(--accent))",
    destructive: "hsl(var(--destructive))",
    success: "hsl(var(--success))",
    warning: "hsl(var(--warning))",
    muted: "hsl(var(--muted))",

    // Forest palette families
    emerald: {
      50: "hsl(var(--emerald-50))",
      100: "hsl(var(--emerald-100))",
      200: "hsl(var(--emerald-200))",
      300: "hsl(var(--emerald-300))",
      400: "hsl(var(--emerald-400))",
      500: "hsl(var(--emerald-500))",
      600: "hsl(var(--emerald-600))",
      700: "hsl(var(--emerald-700))",
      800: "hsl(var(--emerald-800))",
      900: "hsl(var(--emerald-900))",
      950: "hsl(var(--emerald-950))",
    },
    canopy: {
      50: "hsl(var(--canopy-50))",
      500: "hsl(var(--canopy-500))",
      800: "hsl(var(--canopy-800))",
      950: "hsl(var(--canopy-950))",
    },
    bark: {
      50: "hsl(var(--bark-50))",
      500: "hsl(var(--bark-500))",
      800: "hsl(var(--bark-800))",
    },
    moss: {
      50: "hsl(var(--moss-50))",
      500: "hsl(var(--moss-500))",
      700: "hsl(var(--moss-700))",
    },
    sunlight: {
      50: "hsl(var(--sunlight-50))",
      400: "hsl(var(--sunlight-400))",
      500: "hsl(var(--sunlight-500))",
    },
  },

  typography: {
    fontFamily: {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      mono: "'JetBrains Mono', Menlo, Monaco, Consolas, monospace",
    },
    fontSize: {
      "2xs": "0.625rem",   // 10px
      xs: "0.75rem",       // 12px
      sm: "0.875rem",      // 14px
      base: "1rem",        // 16px
      lg: "1.125rem",      // 18px
      xl: "1.25rem",       // 20px
      "2xl": "1.5rem",     // 24px
      "3xl": "1.875rem",   // 30px
      "4xl": "2.25rem",    // 36px
      "5xl": "3rem",       // 48px
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    lineHeight: {
      tight: "1.25",
      snug: "1.375",
      normal: "1.5",
      relaxed: "1.625",
    },
    letterSpacing: {
      tight: "-0.025em",
      normal: "0",
      wide: "0.025em",
    },
  },

  spacing: {
    px: "1px",
    0: "0",
    0.5: "0.125rem",
    1: "0.25rem",
    1.5: "0.375rem",
    2: "0.5rem",
    2.5: "0.625rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    8: "2rem",
    10: "2.5rem",
    12: "3rem",
    16: "4rem",
    20: "5rem",
    24: "6rem",
  },

  borderRadius: {
    none: "0",
    sm: "calc(var(--radius) - 4px)",   // 0.375rem
    md: "calc(var(--radius) - 2px)",   // 0.5rem
    lg: "var(--radius)",               // 0.625rem
    xl: "calc(var(--radius) + 4px)",   // 1rem
    "2xl": "calc(var(--radius) + 8px)", // 1.125rem
    full: "9999px",
  },

  shadows: {
    sm: "0 1px 2px 0 hsl(var(--emerald-950) / 0.05)",
    DEFAULT: "0 1px 3px 0 hsl(var(--emerald-950) / 0.1), 0 1px 2px -1px hsl(var(--emerald-950) / 0.1)",
    md: "0 4px 6px -1px hsl(var(--emerald-950) / 0.1), 0 2px 4px -2px hsl(var(--emerald-950) / 0.1)",
    lg: "0 10px 15px -3px hsl(var(--emerald-950) / 0.1), 0 4px 6px -4px hsl(var(--emerald-950) / 0.1)",
    xl: "0 20px 25px -5px hsl(var(--emerald-950) / 0.1), 0 8px 10px -6px hsl(var(--emerald-950) / 0.1)",
    glow: "0 0 15px hsl(var(--emerald-500) / 0.15)",
    inner: "inset 0 2px 4px 0 hsl(var(--emerald-950) / 0.05)",
  },

  transitions: {
    fast: "150ms ease",
    normal: "200ms ease",
    slow: "300ms ease",
    spring: "300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
  },

  zIndex: {
    dropdown: 50,
    sticky: 100,
    overlay: 200,
    modal: 300,
    popover: 400,
    toast: 500,
  },
} as const;

/**
 * CRE-specific semantic tokens for commercial real estate context
 */
export const creTokens = {
  // Status colors for deal stages
  dealStatus: {
    prospect: "emerald-200",
    underReview: "sunlight-300",
    underContract: "emerald-400",
    closed: "emerald-700",
    dead: "bark-400",
  },

  // Performance indicator colors
  performance: {
    excellent: "emerald-500",
    good: "emerald-300",
    average: "sunlight-400",
    belowAverage: "sunlight-600",
    poor: "destructive",
  },

  // Property type colors
  propertyType: {
    office: "emerald-500",
    retail: "sunlight-500",
    industrial: "canopy-600",
    multifamily: "moss-500",
    mixedUse: "bark-500",
  },
} as const;

export type DesignTokens = typeof tokens;
export type CRETokens = typeof creTokens;
