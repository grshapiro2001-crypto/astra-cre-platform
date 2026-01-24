/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Emerald Forest extended palette
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
          100: "hsl(var(--canopy-100))",
          200: "hsl(var(--canopy-200))",
          300: "hsl(var(--canopy-300))",
          400: "hsl(var(--canopy-400))",
          500: "hsl(var(--canopy-500))",
          600: "hsl(var(--canopy-600))",
          700: "hsl(var(--canopy-700))",
          800: "hsl(var(--canopy-800))",
          900: "hsl(var(--canopy-900))",
          950: "hsl(var(--canopy-950))",
        },
        bark: {
          50: "hsl(var(--bark-50))",
          100: "hsl(var(--bark-100))",
          200: "hsl(var(--bark-200))",
          300: "hsl(var(--bark-300))",
          400: "hsl(var(--bark-400))",
          500: "hsl(var(--bark-500))",
          600: "hsl(var(--bark-600))",
          700: "hsl(var(--bark-700))",
          800: "hsl(var(--bark-800))",
          900: "hsl(var(--bark-900))",
        },
        moss: {
          50: "hsl(var(--moss-50))",
          100: "hsl(var(--moss-100))",
          200: "hsl(var(--moss-200))",
          300: "hsl(var(--moss-300))",
          400: "hsl(var(--moss-400))",
          500: "hsl(var(--moss-500))",
          600: "hsl(var(--moss-600))",
          700: "hsl(var(--moss-700))",
        },
        sunlight: {
          50: "hsl(var(--sunlight-50))",
          100: "hsl(var(--sunlight-100))",
          200: "hsl(var(--sunlight-200))",
          300: "hsl(var(--sunlight-300))",
          400: "hsl(var(--sunlight-400))",
          500: "hsl(var(--sunlight-500))",
          600: "hsl(var(--sunlight-600))",
          700: "hsl(var(--sunlight-700))",
          800: "hsl(var(--sunlight-800))",
          900: "hsl(var(--sunlight-900))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "forest-sm": "0 1px 2px 0 hsl(var(--emerald-950) / 0.05)",
        "forest": "0 1px 3px 0 hsl(var(--emerald-950) / 0.1), 0 1px 2px -1px hsl(var(--emerald-950) / 0.1)",
        "forest-md": "0 4px 6px -1px hsl(var(--emerald-950) / 0.1), 0 2px 4px -2px hsl(var(--emerald-950) / 0.1)",
        "forest-lg": "0 10px 15px -3px hsl(var(--emerald-950) / 0.1), 0 4px 6px -4px hsl(var(--emerald-950) / 0.1)",
        "forest-xl": "0 20px 25px -5px hsl(var(--emerald-950) / 0.1), 0 8px 10px -6px hsl(var(--emerald-950) / 0.1)",
        "forest-glow": "0 0 15px hsl(var(--emerald-500) / 0.15)",
        "forest-inner": "inset 0 2px 4px 0 hsl(var(--emerald-950) / 0.05)",
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
        "shimmer": "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
