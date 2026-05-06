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

export function defineStyleAnatomy<T extends string>(parts: Record<T, any>) {
    return parts
}

export type ComponentAnatomy<T extends Record<string, any>> = {
    [K in keyof T as `${string & K}Class`]?: string
}
