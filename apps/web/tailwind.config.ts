import type { Config } from "tailwindcss"

import forms from "@tailwindcss/forms"
import scrollbarHide from "tailwind-scrollbar-hide"
import animate from "tailwindcss-animate"

/** Color de un token CSS que acepta el modificador de opacidad de Tailwind (bg-x/60). */
const withAlpha = (cssVar: string) =>
    `color-mix(in srgb, var(${cssVar}) calc(<alpha-value> * 100%), transparent)`

const config: Config = {
    darkMode: "class",
    // hover:/group-hover: solo con mouse (@media (hover:hover) and (pointer:fine)).
    // En táctil el hover se "pega" tras el toque (tarjetas agrandadas, botones
    // iluminados) y en iOS el primer toque solo aplica el hover. Ningún control
    // funcional depende de hover para aparecer (revisado 26/09/2026); el feedback
    // táctil va por active:.
    future: {
        hoverOnlyWhenSupported: true,
    },
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
        extend: {
            // Pasos intermedios que ya usa el código (sectionbar, admin, cronología):
            // sin definirlos, h-6.5 / p-4.5 no generaban clase y los elementos
            // quedaban sin tamaño ni padding.
            spacing: {
                "4.5": "1.125rem",
                "6.5": "1.625rem",
            },
            fontFamily: {
                sans: ["Google Sans Flex", "Google Sans", "Product Sans", "Outfit Variable", "Outfit", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
                display: ["Google Sans Flex", "Google Sans", "Product Sans", "Outfit Variable", "Outfit", "sans-serif"],
                mono: ["Space Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"],
                serif: ["Cormorant Garamond", "Georgia", "Cambria", "Times New Roman", "serif"],
                // Kanji decorativos (sellos de era, cronología): mincho del sistema, sin descargas.
                kanji: ["Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", "MS Mincho", "serif"],
            },
            transitionDuration: {
                "150": "150ms",
                "200": "200ms",
                "250": "250ms",
                "300": "300ms",
                "500": "500ms",
                // Tokens del design system: apuntan a animation.css (única fuente de
                // verdad) para que Tailwind y CSS no se desvíen. duration-base es el
                // default del sistema.
                // `fast` conserva los 150ms que siempre renderizó Tailwind (117 usos);
                // en animation.css --duration-fast también vale 150ms (alias de --duration-quick).
                fast: "var(--duration-quick)",
                quick: "var(--duration-quick)",
                base: "var(--duration-base)",
                medium: "var(--duration-medium)",
                slow: "var(--duration-slow)",
                "very-slow": "var(--duration-very-slow)",
                slower: "var(--duration-slower)",
            },
            transitionTimingFunction: {
                DEFAULT: "cubic-bezier(0.2, 0, 0.38, 0.9)",
                standard: "cubic-bezier(0.2, 0, 0.38, 0.9)",
                "bounce-spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
                // Tokens del design system (animation.css)
                "smooth-out": "var(--ease-smooth-out)",
                "expo-out": "var(--ease-expo-out)",
                "out-strong": "var(--ease-out)",
                drawer: "var(--ease-drawer)",
            },
            keyframes: {
                // `slide-up` NO se define acá: el sistema de motion (styles/tokens/animation.css) tiene el
                // suyo (entrada: opacity 0→1 y sube 10 px). Un keyframe con el mismo nombre aquí lo pisaba
                // en el build (la salida 1→0 de 150 ms) y todo `.animate-slide-up` (título, acciones y
                // portada de las fichas) parpadeaba: visible → se apagaba → volvía a aparecer.
                "indeterminate-progress": {
                    "0%": { transform: " translateX(0) scaleX(0)" },
                    "40%": { transform: "translateX(0) scaleX(0.4)" },
                    "100%": { transform: "translateX(100%) scaleX(0.5)" },
                },
                "shimmer": {
                    "100%": { transform: "translateX(100%)" },
                },
            },
            animation: {
                "indeterminate-progress": "indeterminate-progress 1s infinite ease-out",
                "shimmer": "shimmer 2s infinite",
                // Respiración lenta de los estados vacíos (empty-state).
                "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            },
            // Micro-tipografía (metadata, badges, overlines): pasos fijos en px que
            // antes eran arbitrarios text-[8px]..text-[11px] repartidos en ~450 usos.
            // Solo font-size (sin line-height), igual que los arbitrarios.
            fontSize: {
                // Tamaños definidos por los tokens de typography.css.
                "2xs": "var(--fs-2xs)",
                "3xs": "var(--fs-3xs)",
                "4xs": "var(--fs-4xs)",
                "5xs": "var(--fs-5xs)",
            },
            letterSpacing: {
                // Escala 0.2em del design system (typography.css --tracking-ultra),
                // usada por label-sm/button-xs/overline. Tailwind no la trae por
                // defecto, por eso los labels caían en el arbitrario tracking-[0.2em].
                ultra: "var(--tracking-ultra)",
                // Pasos cinematic (mayúsculas muy espaciadas del look v3) — antes
                // eran arbitrarios tracking-[0.15em..0.5em] en player/heroes/overlays.
                cinema: "var(--tracking-cinema)",
                "cinema-md": "var(--tracking-cinema-md)",
            },
            boxShadow: {
                "md": "0 1px 3px 0 rgba(0, 0, 0, 0.1),0 1px 2px 0 rgba(0, 0, 0, 0.06)",
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
                "hero": "var(--shadow-hero)",
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
            },
            zIndex: {
                "hero-base": "var(--z-hero-base)",
                "hero-visual": "var(--z-hero-visual)",
                "hero-scrim": "var(--z-hero-scrim)",
                "hero-content": "var(--z-hero-content)",
                "hero-controls": "var(--z-hero-controls)",
                dropdown: "var(--z-dropdown)",
                sticky: "var(--z-sticky)",
                navbar: "var(--z-navbar)",
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
            },
            backdropBlur: {
                "overlay-xs": "var(--blur-overlay-xs)",
                "overlay-sm": "var(--blur-overlay-sm)",
                "overlay-md": "var(--blur-overlay-md)",
            },
            blur: {
                DEFAULT: "var(--filter-blur-default, 8px)",
                md: "var(--filter-blur-md, 12px)",
                "3xl": "var(--filter-blur-3xl, 64px)",
                hero: "var(--filter-blur-hero, 12px)",
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
            // Tokens con alfa propio (`H S% L% / A`): sin <alpha-value>, que produciría `hsl(… / A / 1)` (inválido).
            overlay: "hsl(var(--overlay))",
            "border-subtle": "hsl(var(--border-subtle))",
            "on-surface": "rgba(var(--on-surface-rgb), <alpha-value>)",
            "on-surface-variant": "rgba(var(--on-surface-variant-rgb), <alpha-value>)",
            // Etiquetas de texto (--label-1/2/3): jerarquía garantizada sobre las superficies de contenido.
            "label-1": "var(--label-1)",
            "label-2": "var(--label-2)",
            "label-3": "var(--label-3)",
            "on-primary": "rgba(var(--on-primary-rgb), <alpha-value>)",
            // Familia semántica de estado (error/success/warning)
            "status-error": "rgba(var(--status-error-rgb), <alpha-value>)",
            "status-error-fg": "rgba(var(--status-error-fg-rgb), <alpha-value>)",
            "status-success": "rgba(var(--status-success-rgb), <alpha-value>)",
            "status-warning": "rgba(var(--status-warning-rgb), <alpha-value>)",
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
                // Texto chico (≥4.5:1 sobre fondo oscuro); relleno y bordes siguen en DEFAULT
                readable: "var(--brand-accent-readable)",
            },
            "brand-secondary": "hsl(var(--brand-secondary) / <alpha-value>)",
            "brand-destructive": "hsl(var(--brand-destructive) / <alpha-value>)",
            "brand-success": "hsl(var(--brand-success) / <alpha-value>)",
            "brand-warning": "hsl(var(--brand-warning) / <alpha-value>)",
            // withAlpha: bg-bg-primary/40 funciona (con var() pelado no se generaba).
            bg: {
                primary: withAlpha("--bg-primary"),
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
                variant: withAlpha("--md-sys-color-surface-variant"),
            },
            outline: withAlpha("--md-sys-color-outline"),
            "outline-variant": withAlpha("--md-sys-color-outline-variant"),
            },
        },
    },
    plugins: [
        forms,
        scrollbarHide,
        animate,
    ],
}
export default config
