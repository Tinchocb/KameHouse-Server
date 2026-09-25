import type { Config } from "tailwindcss"

import forms from "@tailwindcss/forms"
import scrollbarHide from "tailwind-scrollbar-hide"
import animate from "tailwindcss-animate"

import flattenColorPalette from "tailwindcss/lib/util/flattenColorPalette"


/** Color de un token CSS que acepta el modificador de opacidad de Tailwind (bg-x/60). */
const withAlpha = (cssVar: string) =>
    `color-mix(in srgb, var(${cssVar}) calc(<alpha-value> * 100%), transparent)`

const config: Config = {
    darkMode: "class",
    content: [
        "./index.html",
        "./src/**/*.{ts,tsx}",
    ],
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
            // Pasos intermedios que ya usa el código (sectionbar, admin, cronología):
            // sin definirlos, h-6.5 / p-4.5 / h-34 no generaban clase y los elementos
            // quedaban sin tamaño ni padding.
            spacing: {
                "4.5": "1.125rem",
                "6.5": "1.625rem",
                "34": "8.5rem",
            },
            scale: {
                "102": "1.02",
                "115": "1.15",
            },
            screens: {
                "3xl": "1600px",
                "4xl": "1800px",
            },
            fontFamily: {
                sans: ["Outfit Variable", "Outfit", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
                display: ["Outfit Variable", "Outfit", "sans-serif"],
                mono: ["Space Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"],
                serif: ["Cormorant Garamond", "Georgia", "Cambria", "Times New Roman", "serif"],
                // Kanji decorativos (sellos de era, cronología): mincho del sistema, sin descargas.
                kanji: ["Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", "MS Mincho", "serif"],
            },
            transitionDuration: {
                "50": "50ms",
                "100": "100ms",
                "150": "150ms",
                "200": "200ms",
                "250": "250ms",
                "300": "300ms",
                "400": "400ms",
                "500": "500ms",
                // Tokens del design system: apuntan a animation.css (única fuente de
                // verdad) para que Tailwind y CSS no se desvíen. duration-base es el
                // default del sistema.
                // `fast` conserva los 150ms que siempre renderizó Tailwind (117 usos);
                // en animation.css --duration-fast vale 250ms, igual que base.
                fast: "var(--duration-quick)",
                quick: "var(--duration-quick)",
                base: "var(--duration-base)",
                medium: "var(--duration-medium)",
                slow: "var(--duration-slow)",
                "very-slow": "var(--duration-very-slow)",
                slower: "var(--duration-slower)",
                slowest: "var(--duration-slowest)",
            },
            transitionTimingFunction: {
                DEFAULT: "cubic-bezier(0.2, 0, 0.38, 0.9)",
                standard: "cubic-bezier(0.2, 0, 0.38, 0.9)",
                emphasized: "cubic-bezier(0.2, 0, 0, 1)",
                decelerated: "cubic-bezier(0.05, 0.7, 0.1, 1)",
                "bounce-spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
                "image-zoom": "cubic-bezier(0.2, 1, 0.2, 1)",
                // Tokens del design system (animation.css)
                "smooth-out": "var(--ease-smooth-out)",
                "expo-out": "var(--ease-expo-out)",
                "out-strong": "var(--ease-out)",
                drawer: "var(--ease-drawer)",
                fluid: "cubic-bezier(0.2, 0.8, 0.2, 1)",
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
                // Respiración lenta de los estados vacíos (empty-state).
                "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "scale-x": "scale-x 2s ease-in-out infinite",
            },
            // Micro-tipografía (metadata, badges, overlines): pasos fijos en px que
            // antes eran arbitrarios text-[8px]..text-[11px] repartidos en ~450 usos.
            // Solo font-size (sin line-height), igual que los arbitrarios.
            fontSize: {
                "2xs": "11px",
                "3xs": "10px",
                "4xs": "9px",
                "5xs": "8px",
            },
            letterSpacing: {
                // Escala 0.2em del design system (typography.css --tracking-ultra),
                // usada por label-sm/button-xs/overline. Tailwind no la trae por
                // defecto, por eso los labels caían en el arbitrario tracking-[0.2em].
                ultra: "var(--tracking-ultra)",
                // Pasos cinematic (mayúsculas muy espaciadas del look v3) — antes
                // eran arbitrarios tracking-[0.15em..0.5em] en player/heroes/overlays.
                display: "var(--tracking-display)",
                cinema: "var(--tracking-cinema)",
                "cinema-md": "var(--tracking-cinema-md)",
                "cinema-lg": "var(--tracking-cinema-lg)",
                "cinema-xl": "var(--tracking-cinema-xl)",
            },
            boxShadow: {
                "md": "0 1px 3px 0 rgba(0, 0, 0, 0.1),0 1px 2px 0 rgba(0, 0, 0, 0.06)",
                "glass": "var(--shadow-glass, 0 20px 40px -15px rgba(0,0,0,0.7))",
                "glass-liquid": "var(--shadow-glass-liquid)",
                "elevation-1": "var(--elevation-1)",
                "elevation-2": "var(--elevation-2)",
                "elevation-3": "var(--elevation-3)",
                "elevation-4": "var(--elevation-4)",
                "elevation-5": "var(--elevation-5)",
                // Escritas con el color como var (no el token --glass-highlight-* entero)
                // para que Tailwind las pueda teñir: hover:shadow-brand-accent/15.
                "glass-highlight-sm": "inset 0 1px 1px 0 var(--glass-highlight-sm-color)",
                "glass-highlight-md": "inset 0 1px 1px 0 var(--glass-highlight-md-color)",
                "glass-highlight-lg": "inset 0 1px 1px 0 var(--glass-highlight-lg-color)",
                "brand-primary": "var(--shadow-brand-primary)",
                "brand-secondary": "var(--shadow-brand-secondary)",
                "brand-destructive": "var(--shadow-brand-destructive)",
                "brand-success": "var(--shadow-brand-success)",
                "brand-magic": "var(--shadow-brand-magic)",
                "brand-focus": "var(--shadow-brand-focus)",
                "glow-tip": "var(--shadow-glow-tip)",
                "hero": "var(--shadow-hero)",
                "hero-cta": "var(--shadow-hero-cta-primary)",
                "hero-cta-hover": "var(--shadow-hero-cta-primary-hover)",
                "hero-dot": "var(--shadow-hero-dot-active)",
                "modal": "var(--shadow-modal, var(--elevation-3))",
                "player": "var(--shadow-player, var(--elevation-4))",
                "overlay": "var(--shadow-overlay, var(--elevation-3))",
            },
            borderRadius: {
                none: "var(--radius-none, 0px)",
                xs: "var(--radius-xs, 4px)",
                sm: "var(--radius-sm, 8px)",
                md: "var(--radius-md, 12px)",
                lg: "var(--radius-lg, 16px)",
                xl: "var(--radius-xl, 20px)",
                "2xl": "var(--radius-2xl, 24px)",
                "3xl": "var(--radius-3xl, 28px)",
                "4xl": "var(--radius-4xl, 32px)",
                full: "var(--radius-full, 9999px)",
                pill: "9999px",
                container: "var(--radius-container, 16px)",
                "corner-lg": "var(--radius-corner-lg, 28px)",
                hero: "var(--radius-hero, 28px)",
            },
            maxWidth: {
                content: "var(--content-max)",
                "content-desktop": "var(--content-max-desktop)",
                "hero-content": "var(--hero-content-max-w, 30rem)",
                "hero-content-wide": "var(--hero-content-max-w-wide, 42rem)",
            },
            zIndex: {
                base: "var(--z-base)",
                "hero-base": "var(--z-hero-base)",
                "hero-visual": "var(--z-hero-visual)",
                "hero-scrim": "var(--z-hero-scrim)",
                "hero-content": "var(--z-hero-content)",
                "hero-controls": "var(--z-hero-controls)",
                raised: "var(--z-raised)",
                dropdown: "var(--z-dropdown)",
                sticky: "var(--z-sticky)",
                navbar: "var(--z-navbar)",
                sidebar: "var(--z-sidebar)",
                "mobile-nav": "var(--z-mobile-nav)",
                overlay: "var(--z-overlay)",
                modal: "var(--z-modal)",
                popover: "var(--z-popover)",
                toast: "var(--z-toast)",
                tooltip: "var(--z-tooltip)",
                player: "var(--z-player)",
                "player-ui": "var(--z-player-ui)",
                "player-overlay": "var(--z-player-overlay)",
                "player-sidebar": "var(--z-player-sidebar)",
                "player-settings": "var(--z-player-settings)",
                max: "var(--z-max)",
            },
            backdropBlur: {
                "overlay-xs": "var(--blur-overlay-xs)",
                "overlay-sm": "var(--blur-overlay-sm)",
                "overlay-md": "var(--blur-overlay-md)",
                "overlay-lg": "var(--blur-overlay-lg)",
                "overlay-xl": "var(--blur-overlay-xl)",
                "overlay-2xl": "var(--blur-overlay-2xl)",
            },
            blur: {
                sm: "var(--filter-blur-sm, 4px)",
                DEFAULT: "var(--filter-blur-default, 8px)",
                md: "var(--filter-blur-md, 12px)",
                lg: "var(--filter-blur-lg, 16px)",
                xl: "var(--filter-blur-xl, 24px)",
                "2xl": "var(--filter-blur-2xl, 40px)",
                "3xl": "var(--filter-blur-3xl, 64px)",
                hero: "var(--filter-blur-hero, 12px)",
                "hero-bg": "var(--filter-blur-hero-bg, 32px)",
                orb: "var(--filter-blur-orb, 28px)",
                "ambient-sm": "var(--filter-blur-ambient-sm, 14px)",
                "ambient-md": "var(--filter-blur-ambient-md, 22px)",
                "ambient-lg": "var(--filter-blur-ambient-lg, 28px)",
                "ambient-xl": "var(--filter-blur-ambient-xl, 36px)",
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
            overlay: "hsl(var(--overlay) / <alpha-value>)",
            "border-subtle": "hsl(var(--border-subtle) / <alpha-value>)",
            "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
            "on-surface": "rgba(var(--on-surface-rgb), <alpha-value>)",
            "on-surface-variant": "rgba(var(--on-surface-variant-rgb), <alpha-value>)",
            "on-primary": "rgba(var(--on-primary-rgb), <alpha-value>)",
            "on-secondary": "rgba(var(--on-secondary-rgb), <alpha-value>)",
            "on-accent": "rgba(var(--on-primary-rgb), <alpha-value>)",
            // Familia semántica de estado (error/success/warning)
            "status-error": "rgba(var(--status-error-rgb), <alpha-value>)",
            "status-success": "rgba(var(--status-success-rgb), <alpha-value>)",
            "status-warning": "rgba(var(--status-warning-rgb), <alpha-value>)",
            "secondary-container": "var(--md-sys-color-secondary-container)",
            "on-secondary-container": "var(--md-sys-color-on-secondary-container)",
            // DEFAULT mantiene bg-brand-accent/60; 100–900 es la escala tonal de la era
            // (colors.css), sin modificador de opacidad porque son color-mix.
            "brand-accent": {
                DEFAULT: "hsl(var(--brand-accent) / <alpha-value>)",
                100: "var(--brand-accent-100)",
                200: "var(--brand-accent-200)",
                300: "var(--brand-accent-300)",
                400: "var(--brand-accent-400)",
                500: "var(--brand-accent-500)",
                600: "var(--brand-accent-600)",
                700: "var(--brand-accent-700)",
                800: "var(--brand-accent-800)",
                900: "var(--brand-accent-900)",
            },
            "brand-primary": "hsl(var(--brand-primary) / <alpha-value>)",
            "brand-secondary": "hsl(var(--brand-secondary) / <alpha-value>)",
            "brand-destructive": "hsl(var(--brand-destructive) / <alpha-value>)",
            "brand-success": "hsl(var(--brand-success) / <alpha-value>)",
            "brand-warning": "hsl(var(--brand-warning) / <alpha-value>)",
            "brand-magic": "hsl(var(--brand-magic) / <alpha-value>)",
            color: {
                db: "hsl(var(--era-db-hsl) / <alpha-value>)",
                dbz: "hsl(var(--era-dbz-hsl) / <alpha-value>)",
                dbgt: "hsl(var(--era-dbgt-hsl) / <alpha-value>)",
                dbs: "hsl(var(--era-dbs-hsl) / <alpha-value>)",
                daima: "hsl(var(--era-daima-hsl) / <alpha-value>)",
            },
            // withAlpha: bg-bg-primary/40 funciona (con var() pelado no se generaba).
            bg: {
                primary: withAlpha("--bg-primary"),
                secondary: withAlpha("--bg-secondary"),
                tertiary: withAlpha("--bg-tertiary"),
                quaternary: withAlpha("--bg-quaternary"),
            },
            // Tokens MD3 con soporte de opacidad: con un var() pelado, Tailwind no
            // genera "bg-x/60" (la clase no existe y el estilo se pierde en silencio).
            // withAlpha aplica el modificador con color-mix; sin modificador, <alpha-value>
            // vale 1 y el color queda idéntico al token.
            surface: {
                DEFAULT: withAlpha("--md-sys-color-surface"),
                container: withAlpha("--md-sys-color-surface-container"),
                // Base opaca: la translucidez la pone cada uso (/60, /80...).
                "container-lowest": withAlpha("--md-sys-color-surface-container-lowest"),
                "container-low": withAlpha("--md-sys-color-surface-container-low"),
                "container-high": withAlpha("--md-sys-color-surface-container-high"),
                "container-highest": withAlpha("--md-sys-color-surface-container-highest"),
                variant: withAlpha("--md-sys-color-surface-variant"),
            },
            outline: withAlpha("--md-sys-color-outline"),
            "outline-variant": withAlpha("--md-sys-color-outline-variant"),
            scrim: "rgba(var(--scrim-rgb, 0, 0, 0), <alpha-value>)",
            glass: {
                bg: "var(--glass-bg)",
                border: "var(--glass-border)",
                hover: "var(--glass-hover)",
                strong: "var(--glass-strong)",
            },
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
    // Skip values that already reference a CSS variable (e.g. "hsl(var(--brand-accent) / <alpha-value>)").
    // Re-declaring them under the same --key would shadow the real variable from colors.css
    // with a self-referential, invalid value.
    const newVars = Object.fromEntries(
        Object.entries(allColors)
            .filter(([, val]) => typeof val === "string" && !val.includes("var("))
            .map(([key, val]) => [`--${key}`, val]),
    )

    addBase({
        ":root": newVars,
    })
}
