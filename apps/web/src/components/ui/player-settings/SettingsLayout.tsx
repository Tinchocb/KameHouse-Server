import * as React from "react"
import { m } from "framer-motion"
import { IconNavigationChevronLeft, IconUiClose } from "@/components/ui/icons"
import { useSpringPreset, useReducedMotion } from "@/components/ui/kinetics/hooks"
import { cn } from "@/components/ui/core/styling"
import { PLAYER_GLASS } from "@/components/video/player-theme"

interface SettingsLayoutProps {
    title: string
    onBack?: () => void
    onClose: () => void
    children: React.ReactNode
}

export function SettingsLayout({ title, onBack, onClose, children }: SettingsLayoutProps) {
    const spring = useSpringPreset("entrance")
    const prefersReduced = useReducedMotion()

    return (
        <m.div
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, x: 6 }}
            transition={spring}
            className={cn("w-full md:w-80 rounded-2xl overflow-hidden flex flex-col", PLAYER_GLASS)}
        >
            {/* Header */}
            <div className="flex items-center justify-between h-12 px-1.5 border-b border-white/10">
                <div className="flex items-center gap-1 pl-2">
                    {onBack && (
                        <button
                            onClick={onBack}
                            aria-label="Volver"
                            className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:text-white hover:bg-white/10 transition-[color,background-color,border-color,transform] duration-200 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                        >
                            <IconNavigationChevronLeft className="w-4 h-4" />
                        </button>
                    )}
                    <span className="text-xs font-semibold tracking-wide text-white">
                        {title}
                    </span>
                </div>
                <button
                    onClick={onClose}
                    aria-label="Cerrar menú"
                    className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:text-white hover:bg-white/10 transition-[color,background-color,border-color,transform] duration-200 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                >
                    <IconUiClose className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto scrollbar-none p-1.5">
                {children}
            </div>
        </m.div>
    )
}

interface MenuButtonProps {
    icon: React.ReactNode
    label: string
    value?: string
    onClick: () => void
    rightElement?: React.ReactNode
}

export function MenuButton({ icon, label, value, onClick, rightElement }: MenuButtonProps) {
    return (
        <button
            onClick={onClick}
            className="w-full h-10 flex items-center gap-3 px-3 rounded-full hover:bg-white/10 transition-colors duration-200 group text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
        >
            <span className="text-on-surface-variant group-hover:text-brand-accent transition-colors duration-200">{icon}</span>
            <span className="flex-1 text-xs font-semibold tracking-wide text-white">{label}</span>
            {value && <span className="text-xs text-on-surface-variant truncate max-w-[45%]">{value}</span>}
            {rightElement || (
                <IconNavigationChevronLeft className="w-4 h-4 rotate-180 text-white/30 group-hover:text-white/60 transition-colors duration-150 shrink-0" />
            )}
        </button>
    )
}
