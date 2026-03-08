"use client"

import React, { ReactNode } from "react"
import { Play } from "lucide-react" // Expecting lucide-react to be installed

export interface MediaCardInteractiveProps {
    id: string | number
    title: string
    onClick?: () => void
    children?: ReactNode
}

/**
 * Lightweight Client Component wrapper to handle interactivity over Server-Rendered grid items.
 * Relies entirely on Tailwind group-hover physics for the play button overlay.
 */
export function MediaCardInteractive({ id, title, onClick, children }: MediaCardInteractiveProps) {
    return (
        <button
            type="button"
            className="group absolute inset-0 z-10 flex h-full w-full cursor-pointer flex-col justify-end text-left outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-md"
            onClick={onClick}
            aria-label={`Play ${title}`}
        >
            {/* The underlying RSC structure (like <img>) will sit under or within, depending on injection */}
            {children}

            {/* Hardware-accelerated hover overlay (darkens card, shows Play button) */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 backdrop-blur-none transition-all duration-300 group-hover:bg-black/40 group-hover:opacity-100 group-hover:backdrop-blur-[2px]">
                <div className="flex h-12 w-12 transform items-center justify-center rounded-full bg-orange-500 text-white shadow-lg transition-transform duration-300 group-hover:scale-110">
                    <Play className="ml-1 h-6 w-6 fill-current" />
                </div>
            </div>

            <span className="sr-only">Play {title}</span>
        </button>
    )
}
