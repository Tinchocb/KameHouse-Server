import * as React from "react"
import { m, useIsPresent, usePresenceData, type Variants } from "framer-motion"
import { IconNavigationChevronLeft, IconUiClose } from "@/components/ui/icons"
import { useSpringPreset, useReducedMotion } from "@/components/ui/kinetics/hooks"
import { cn } from "@/components/ui/core/styling"
import { IconButton } from "@/components/ui/button"
import { PLAYER_GLASS } from "@/components/video/player-theme"

interface SettingsLayoutProps {
    title: string
    onBack?: () => void
    onClose: () => void
    children: React.ReactNode
    className?: string
}

/** Sentido de la navegación que llega como `custom` del AnimatePresence del panel:
 * -1 al volver al menú, 1 al entrar a un submenú. Por defecto 1: la hoja de Vaul
 * monta las vistas sin AnimatePresence propio ni `custom` (sin esto, `x` daba NaN). */
const toDirection = (d: unknown): 1 | -1 => (d === -1 ? -1 : 1)

// --ease-out y --duration-quick: la vista que se va sale más corta que lo que entra.
const VIEW_EXIT_TRANSITION = { duration: 0.15, ease: [0.23, 1, 0.32, 1] } as const

const VIEW_VARIANTS: Variants = {
    initial: (d: unknown = 1) => ({ opacity: 0, x: 8 * toDirection(d) }),
    animate: { opacity: 1, x: 0 },
    exit: (d: unknown = 1) => ({ opacity: 0, x: -8 * toDirection(d), transition: VIEW_EXIT_TRANSITION }),
}

const VIEW_VARIANTS_REDUCED: Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, transition: VIEW_EXIT_TRANSITION },
}

export function SettingsLayout({ title, onBack, onClose, children, className }: SettingsLayoutProps) {
    const spring = useSpringPreset("tabContent")
    const prefersReduced = useReducedMotion()
    const direction = toDirection(usePresenceData())
    // Mientras sale (popLayout la deja encima unos 150 ms) no recibe clics.
    const isPresent = useIsPresent()

    return (
        <m.div
            variants={prefersReduced ? VIEW_VARIANTS_REDUCED : VIEW_VARIANTS}
            custom={direction}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={spring}
            className={cn("w-full md:w-80 rounded-2xl overflow-hidden flex flex-col", PLAYER_GLASS, !isPresent && "pointer-events-none", className)}
        >
            {/* Header */}
            <div className="flex items-center justify-between h-12 px-1.5 border-b border-[var(--neutral-separator)]">
                <div className="flex items-center gap-1 pl-2">
                    {onBack && (
                        <IconButton
                            intent="ghost"
                            onClick={onBack}
                            aria-label="Volver"
                            className="rounded-full text-label-2 [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1"
                            icon={<IconNavigationChevronLeft className="w-4 h-4" />}
                        />
                    )}
                    <span className="text-sm font-semibold text-label-1">
                        {title}
                    </span>
                </div>
                <IconButton
                    intent="ghost"
                    onClick={onClose}
                    aria-label="Cerrar menú"
                    className="rounded-full text-label-2 [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1"
                    icon={<IconUiClose className="w-4 h-4" />}
                />
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
            className="w-full min-h-[44px] h-11 flex items-center gap-3 px-3 rounded-full [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] active:scale-95 transition-[background-color,transform] duration-fast ease-out-strong group text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
        >
            <span className="text-label-2 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-brand-accent transition-colors duration-quick">{icon}</span>
            <span className="flex-1 text-sm font-semibold text-label-1">{label}</span>
            {value && <span className="text-xs text-label-2 truncate max-w-[45%]">{value}</span>}
            {rightElement || (
                <IconNavigationChevronLeft className="w-4 h-4 rotate-180 text-label-3 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-label-2 transition-colors duration-quick shrink-0" />
            )}
        </button>
    )
}
