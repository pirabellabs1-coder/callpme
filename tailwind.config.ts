import type { Config } from "tailwindcss";

/**
 * Thème Callpme — identité sur-mesure.
 * Palette : blanc cassé chaud dominant, orange de marque #E8572A, encre noire chaude.
 * Bordures fines, ombres douces teintées chaud, rayons mesurés. Aucun dégradé « IA ».
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1200px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // Orange de marque Callpme (#E8572A)
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
          50: "hsl(18 90% 97%)",
          100: "hsl(16 88% 94%)",
          200: "hsl(15 86% 87%)",
          300: "hsl(15 84% 77%)",
          400: "hsl(14 82% 66%)",
          500: "hsl(14 81% 54%)",
          600: "hsl(14 78% 48%)",
          700: "hsl(14 74% 40%)",
          800: "hsl(14 66% 33%)",
          900: "hsl(14 58% 28%)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
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
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Échelle éditoriale, interligne serré sur les grands titres
        "display-2xl": ["4.5rem", { lineHeight: "1.02", letterSpacing: "-0.035em" }],
        "display-xl": ["3.5rem", { lineHeight: "1.04", letterSpacing: "-0.03em" }],
        "display-lg": ["2.75rem", { lineHeight: "1.06", letterSpacing: "-0.025em" }],
        "display-md": ["2.125rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-sm": ["1.625rem", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(28 22 16 / 0.05)",
        sm: "0 1px 3px 0 rgb(28 22 16 / 0.06), 0 1px 2px -1px rgb(28 22 16 / 0.05)",
        DEFAULT: "0 2px 4px -1px rgb(28 22 16 / 0.06), 0 1px 3px -1px rgb(28 22 16 / 0.04)",
        md: "0 4px 12px -2px rgb(28 22 16 / 0.08), 0 2px 6px -2px rgb(28 22 16 / 0.05)",
        lg: "0 12px 28px -6px rgb(28 22 16 / 0.10), 0 6px 12px -6px rgb(28 22 16 / 0.06)",
        xl: "0 24px 48px -12px rgb(28 22 16 / 0.14), 0 8px 20px -8px rgb(28 22 16 / 0.08)",
        // Lueur de marque très discrète, pour les éléments actifs
        brand: "0 1px 2px 0 rgb(232 87 42 / 0.20), 0 8px 24px -8px rgb(232 87 42 / 0.28)",
        "inner-top": "inset 0 1px 0 0 rgb(255 255 255 / 0.6)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-down": {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-collapsible-content-height)", opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgb(232 87 42 / 0.4)" },
          "70%": { boxShadow: "0 0 0 6px rgb(232 87 42 / 0)" },
          "100%": { boxShadow: "0 0 0 0 rgb(232 87 42 / 0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 0.2s ease-out both",
        shimmer: "shimmer 2s infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
