import type { Config } from "tailwindcss"

import typography from "@tailwindcss/typography"
import forms from "@tailwindcss/forms"
import scrollbarHide from "tailwind-scrollbar-hide"
import animate from "tailwindcss-animate"

// @ts-expect-error - tailwindcss does not provide types for this utility
import flattenColorPalette from "tailwindcss/lib/util/flattenColorPalette"


const config: Config = {
    darkMode: "class",
    content: [
        "./index.html",
        "./src/**/*.{ts,tsx,mdx}",
    ],
    safelist: [],
    theme: {
        container: {
            center: true,
            padding: {
                DEFAULT: "1rem",
                sm: "2rem",
                lg: "4rem",
                xl: "5rem",
                "2xl": "6rem",
            },
            screens: {
                "2xl": "1400px",
                "3xl": "1600px",
                "4xl": "1800px",
                "5xl": "2000px",
                "6xl": "2200px",
                "7xl": "2400px",
            },
        },
        data: {
            checked: "checked",
            selected: "selected",
            disabled: "disabled",
            highlighted: "highlighted",
        },
        extend: {
            fontFamily: {
                sans: ["Inter Variable", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue",
                    "Arial", "sans-serif"],
            },
            screens: {
                "3xl": "1600px",
                "4xl": "1800px",
                "5xl": "2000px",
                "6xl": "2200px",
                "7xl": "2400px",
            },
            animationDuration: {
                DEFAULT: "0.25s",
            },
            transitionDuration: {
                "15": "15ms",
                "50": "50ms",
            },
            transitionTimingFunction: {
                DEFAULT: "cubic-bezier(0.25, 0.1, 0.25, 1.0)",
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
                "slide-down": {
                    from: { transform: "translateY(-1rem)", opacity: "0" },
                    to: { transform: "translateY(0)", opacity: "1" },
                },
                "slide-up": {
                    from: { transform: "translateY(0)", opacity: "1" },
                    to: { transform: "translateY(-1rem)", opacity: "0" },
                },
                "indeterminate-progress": {
                    "0%": { transform: " translateX(0) scaleX(0)" },
                    "40%": { transform: "translateX(0) scaleX(0.4)" },
                    "100%": { transform: "translateX(100%) scaleX(0.5)" },
                },
                "shimmer": {
                    "100%": { transform: "translateX(100%)" },
                },
                "scale-x": {
                    "0%, 100%": { transform: "scaleX(0.5)", opacity: "0.3" },
                    "50%": { transform: "scaleX(1.5)", opacity: "1" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.15s linear",
                "accordion-up": "accordion-up 0.15s linear",
                "slide-down": "slide-down 0.15s ease-in-out",
                "slide-up": "slide-up 0.15s ease-in-out",
                "indeterminate-progress": "indeterminate-progress 1s infinite ease-out",
                "shimmer": "shimmer 2s infinite",
                "spin-slow": "spin 8s linear infinite",
                "scale-x": "scale-x 2s ease-in-out infinite",
            },
            transformOrigin: {
                "left-right": "0% 100%",
            },
            boxShadow: {
                "md": "0 1px 3px 0 rgba(0, 0, 0, 0.1),0 1px 2px 0 rgba(0, 0, 0, 0.06)",
                "glass": "0 20px 40px -15px rgba(0,0,0,0.7)",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            colors: {
                border: "hsl(var(--border) / <alpha-value>)",
                input: "hsl(var(--input) / <alpha-value>)",
                ring: "hsl(var(--ring) / <alpha-value>)",
                background: "hsl(var(--background) / <alpha-value>)",
                foreground: "hsl(var(--foreground) / <alpha-value>)",
                primary: {
                    DEFAULT: "hsl(var(--primary) / <alpha-value>)",
                    foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
                    foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
                    foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted) / <alpha-value>)",
                    foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent) / <alpha-value>)",
                    foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover) / <alpha-value>)",
                    foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
                },
                card: {
                    DEFAULT: "hsl(var(--card) / <alpha-value>)",
                    foreground: "hsl(var(--card-foreground) / <alpha-value>)",
                },
                surface: {
                    1: "hsl(var(--surface-1) / <alpha-value>)",
                    2: "hsl(var(--surface-2) / <alpha-value>)",
                },
                overlay: "hsl(var(--overlay) / <alpha-value>)",
                "border-subtle": "hsl(var(--border-subtle) / <alpha-value>)",
                "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
                text: {
                    primary: "hsl(var(--text-primary) / <alpha-value>)",
                    secondary: "hsl(var(--text-secondary) / <alpha-value>)",
                    muted: "hsl(var(--text-muted) / <alpha-value>)",
                },
                "brand-orange": "hsl(var(--brand-orange) / <alpha-value>)",
                brand: {
                    50: "#ffffff",
                    100: "#f4f4f5",
                    200: "#e4e4e7",
                    300: "#d4d4d8",
                    400: "#a1a1aa",
                    500: "#71717a",
                    600: "#52525b",
                    700: "#3f3f46",
                    800: "#27272a",
                    900: "#18181b",
                    950: "#09090b",
                    DEFAULT: "#ffffff",
                },
                gray: {
                    50: "#f9fafb",
                    100: "#f3f4f6",
                    200: "#e5e7eb",
                    300: "#d1d5db",
                    400: "#9ca3af",
                    500: "#6b7280",
                    600: "#4b5563",
                    700: "#374151",
                    800: "#1f2937",
                    900: "#141419",
                    950: "#0B0B0F",
                    DEFAULT: "#6b7280",
                },
                ui: {
                    background: "#000000",
                    surface: "#0D0D0D",
                    hover: "#141414"
                },
                audienceScore: {
                    300: "#b45d5d",
                    500: "#9d8741",
                    600: "#a0b974",
                    700: "#57a181",
                },
            },
        },
    },
    plugins: [
        typography,
        forms,
        scrollbarHide,
        animate,
        addVariablesForColors,
        function ({ addVariant }: { addVariant: (variant: string, selector: string) => void }) {
            addVariant("firefox", ":-moz-any(&)")
        },
    ],
}
export default config


function addVariablesForColors({ addBase, theme }: { addBase: any; theme: any }) {
    const allColors = flattenColorPalette(theme("colors"))
    const newVars = Object.fromEntries(
        Object.entries(allColors).map(([key, val]) => [`--${key}`, val]),
    )

    addBase({
        ":root": newVars,
    })
}
