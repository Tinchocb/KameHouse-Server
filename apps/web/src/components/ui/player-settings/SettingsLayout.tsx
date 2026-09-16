import * as React from "react"
import { motion } from "framer-motion"
import { IconNavigationChevronLeft, IconUiClose } from "@/components/ui/icons";

interface SettingsLayoutProps {
    title: string
    onBack?: () => void
    onClose: () => void
    children: React.ReactNode
}

export function SettingsLayout({ title, onBack, onClose, children }: SettingsLayoutProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-full max-w-80 bg-zinc-950/85 backdrop-blur-overlay-2xl border border-white/20 border-t-white/40 border-b-white/10 rounded-2xl shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_20px_40px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-950/40">
                <div className="flex items-center ml-2 [&>*:not(:first-child)]:ml-2">
                    {onBack && (
                        <button
                            onClick={onBack}
                            aria-label="Volver"
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-900/60 hover:bg-zinc-800 border border-white/15 border-t-white/30 border-b-white/10 text-zinc-400 hover:text-white transition-all duration-base cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
                        >
                            <IconNavigationChevronLeft className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <span className="text-label-sm font-black uppercase tracking-ultra text-white/90">
                        {title}
                    </span>
                </div>
                <button
                    onClick={onClose}
                    aria-label="Cerrar menú"
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-900/60 hover:bg-zinc-800 border border-white/15 border-t-white/30 border-b-white/10 text-zinc-400 hover:text-white transition-all duration-base cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
                >
                    <IconUiClose className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto scrollbar-none py-2">
                {children}
            </div>
        </motion.div>
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
            className="w-full flex items-center justify-between px-4 py-3 md:py-3 hover:bg-white/5 transition-all duration-base ease-out group text-left relative overflow-hidden"
        >
            {/* Hover visual accent indicator on the left edge */}
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-0 bg-brand-accent group-hover:h-1/2 transition-all duration-base ease-out rounded-r-md" />
            
            <div className="flex items-center ml-3 group-hover:translate-x-1.5 transition-transform duration-base ease-out [&>*:not(:first-child)]:ml-3">
                <div className="text-on-surface-variant group-hover:text-brand-accent transition-colors duration-base">
                    {icon}
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-on-surface group-hover:text-on-surface transition-colors duration-base">
                        {label}
                    </span>
                    {value && (
                        <span className="text-label-sm font-medium text-on-surface-variant group-hover:text-on-surface transition-colors duration-base">
                            {value}
                        </span>
                    )}
                </div>
            </div>
            
            <div className="group-hover:-translate-x-0.5 transition-transform duration-base ease-out">
                {rightElement || (
                    <IconNavigationChevronLeft className="w-4 h-4 rotate-180 text-outline-variant group-hover:text-on-surface-variant transition-colors duration-base" />
                )}
            </div>
        </button>
    )
}
