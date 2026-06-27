import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export const brutalistStyles = {
    border: "border border-zinc-800",
    borderHover: "hover:border-zinc-500",
    bg: "bg-black",
    bgMuted: "bg-zinc-950",
    text: "text-zinc-100",
    textMuted: "text-zinc-400",
    card: "bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors",
    interactive: "hover:bg-zinc-900 transition-colors cursor-pointer",
}

export const scrollStyles = {
    hide: "scrollbar-none",
    thin: "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700",
    custom: "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-800 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-700",
}

export function defineStyleAnatomy<T extends Record<string, any>>(parts: T): T {
    return parts
}

export type ComponentAnatomy<T extends Record<string, any>> = {
    [K in keyof T as `${string & K}Class`]?: string
}

export const cssUtils = {
    // Focus states
    focusRing: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6e3a] focus-visible:ring-offset-2",

    // Glassmorphism
    glass: "bg-surface-1/80 backdrop-blur-xl border border-white/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.5)]",
    glassInteractive: "hover:border-[#ff6e3a]/30 hover:bg-surface-2/50 transition-all",

    // Tabs
    tab: "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6e3a] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#ff6e3a] data-[state=active]:to-[#f97316] data-[state=active]:text-white data-[state=active]:shadow-sm",

    // Pills
    pill: "inline-flex items-center px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 border",
    pillActive: "bg-gradient-to-r from-[#ff6e3a] to-[#f97316] text-white border-transparent shadow-lg",
    pillInactive: "bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-[#ff6e3a]/30 hover:bg-white/[0.06]",

    // Slider
    slider: "w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-[#ff6e3a]",
    sliderThumb: "appearance-none w-5 h-5 rounded-full bg-[#ff6e3a] cursor-pointer transition-all",

    // Card
    card: "liquid-glass-frosted rounded-3xl overflow-hidden",

    // Field wrapper
    field: "space-y-2",

    // Label
    label: "text-sm font-semibold text-zinc-200 block mb-2",

    // Description
    description: "text-xs text-zinc-500 mt-1 leading-relaxed",

    // Error
    error: "text-xs text-red-400 mt-1",

    // Helper
    helper: "text-xs text-zinc-500 mt-1 font-mono",

    // Transition
    transition: "transition-all duration-300 ease-out",

    // Glow effect
    glow: "shadow-[0_0_15px_hsl(var(--brand-orange)/0.25)]",
}
