import type { Config } from "tailwindcss";

/**
 * Thème Callpme — identité sur-mesure.
 * Callpme 2.0 : sombre premium par défaut (noir chaud, hairlines), orange de marque
 * #E8572A en accent rare. Ombres profondes et diffuses. Aucun dégradé multicolore.
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
        // Échelle éditoriale FLUIDE (clamp) : se réduit sur mobile, monte sur desktop.
        "display-2xl": ["clamp(2.5rem, 2rem + 3.5vw, 4.5rem)", { lineHeight: "1.04", letterSpacing: "-0.035em" }],
        "display-xl": ["clamp(2.25rem, 1.5rem + 3vw, 3.5rem)", { lineHeight: "1.06", letterSpacing: "-0.03em" }],
        "display-lg": ["clamp(1.875rem, 1.3rem + 2.4vw, 2.75rem)", { lineHeight: "1.08", letterSpacing: "-0.025em" }],
        "display-md": ["clamp(1.5rem, 1.15rem + 1.6vw, 2.125rem)", { lineHeight: "1.12", letterSpacing: "-0.02em" }],
        "display-sm": ["clamp(1.3rem, 1.05rem + 1.1vw, 1.625rem)", { lineHeight: "1.16", letterSpacing: "-0.015em" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        // Ombres pensées pour le fond sombre : profondes, diffuses, jamais dures.
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.45), inset 0 1px 0 0 rgb(255 255 255 / 0.04)",
        DEFAULT: "0 2px 6px -1px rgb(0 0 0 / 0.5), inset 0 1px 0 0 rgb(255 255 255 / 0.04)",
        md: "0 8px 24px -6px rgb(0 0 0 / 0.55), inset 0 1px 0 0 rgb(255 255 255 / 0.05)",
        lg: "0 20px 48px -12px rgb(0 0 0 / 0.6), inset 0 1px 0 0 rgb(255 255 255 / 0.05)",
        xl: "0 32px 80px -16px rgb(0 0 0 / 0.7), inset 0 1px 0 0 rgb(255 255 255 / 0.06)",
        // Lueur de marque, pour les éléments actifs / CTA principaux
        brand: "0 0 0 1px rgb(232 87 42 / 0.35), 0 8px 32px -8px rgb(232 87 42 / 0.45)",
        "inner-top": "inset 0 1px 0 0 rgb(255 255 255 / 0.08)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
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
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(calc(-100% - var(--gap)))" },
        },
        "shiny-text": {
          "0%, 90%, 100%": { "background-position": "calc(-100% - var(--shiny-width)) 0" },
          "30%, 60%": { "background-position": "calc(100% + var(--shiny-width)) 0" },
        },
        "border-beam": {
          "100%": { "offset-distance": "100%" },
        },
        aurora: {
          "0%": { "background-position": "0% 50%", transform: "rotate(-5deg) scale(0.9)" },
          "25%": { "background-position": "50% 100%", transform: "rotate(5deg) scale(1.1)" },
          "50%": { "background-position": "100% 50%", transform: "rotate(-3deg) scale(0.95)" },
          "75%": { "background-position": "50% 0%", transform: "rotate(3deg) scale(1.05)" },
          "100%": { "background-position": "0% 50%", transform: "rotate(-5deg) scale(0.9)" },
        },
        orbit: {
          "0%": {
            transform:
              "rotate(calc(var(--angle) * 1deg)) translateY(calc(var(--radius) * 1px)) rotate(calc(var(--angle) * -1deg))",
          },
          "100%": {
            transform:
              "rotate(calc(var(--angle) * 1deg + 360deg)) translateY(calc(var(--radius) * 1px)) rotate(calc((var(--angle) * -1deg) - 360deg))",
          },
        },
        progress: {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
        shine: {
          "0%": { "background-position": "0% 0%" },
          "50%": { "background-position": "100% 100%" },
          "100%": { "background-position": "0% 0%" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 0.2s ease-out both",
        shimmer: "shimmer 2s infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        marquee: "marquee var(--duration, 32s) linear infinite",
        "shiny-text": "shiny-text 5s ease-in-out infinite",
        "border-beam": "border-beam var(--duration, 8s) linear infinite",
        aurora: "aurora 8s ease-in-out infinite alternate",
        orbit: "orbit calc(var(--duration) * 1s) linear infinite",
        shine: "shine var(--duration) infinite linear",
        progress: "progress var(--progress-duration, 4s) linear forwards",
        wave: "wave 1.1s cubic-bezier(0.32, 0.72, 0, 1) infinite",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        // Courbe « masse et ressort » des transitions premium
        spring: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
