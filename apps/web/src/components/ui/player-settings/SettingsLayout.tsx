import * as React from "react"
import { m, useIsPresent, usePresenceData, type Variants } from "framer-motion"
import { IconNavigationChevronLeft, IconUiClose } from "@/components/ui/icons"
import { useSpringPreset, useReducedMotion } from "@/components/ui/kinetics/hooks"
import { cn } from "@/components/ui/core/styling"
import { IconButton } from "@/components/ui/button"
import { PLAYER_GLASS } from "@/components/video/player-theme"
import { IconSwap } from "@/components/ui/kinetics/icon-swap"

interface SettingsLayoutProps {
    title: string
    titleId?: string
    onBack?: () => void
    onClose: () => void
    children: React.ReactNode
    className?: string
}

/** Sentido de la navegación que llega como `custom` del AnimatePresence del panel:
 * -1 al volver al menú, 1 al entrar a un submenú. Por defecto 1 cuando el panel
 * monta las vistas sin datos de presencia (evita que `x` resulte NaN). */
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

export function SettingsLayout({ title, titleId, onBack, onClose, children, className }: SettingsLayoutProps) {
    const spring = useSpringPreset("tabContent")
    const prefersReduced = useReducedMotion()
    const direction = toDirection(usePresenceData())
    // Mientras sale no recibe clics, foco ni navegación del lector de pantalla.
    const isPresent = useIsPresent()

    return (
        <m.div
            variants={prefersReduced ? VIEW_VARIANTS_REDUCED : VIEW_VARIANTS}
            custom={direction}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={spring}
            inert={!isPresent}
            data-liquid-surface="panel"
            data-liquid-context="video"
            aria-hidden={!isPresent || undefined}
            className={cn("player-settings-surface w-full md:w-80 rounded-2xl overflow-hidden flex flex-col", PLAYER_GLASS, !isPresent && "pointer-events-none", className)}
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
                    <span id={titleId} className="text-sm font-semibold text-label-1">
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
    disabled?: boolean
}

export function MenuButton({ icon, label, value, onClick, rightElement, disabled }: MenuButtonProps) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="w-full min-h-[44px] h-11 flex items-center gap-3 px-3 rounded-full [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] motion-safe:active:scale-[0.97] transition-[background-color,transform] duration-fast ease-out-strong group text-left cursor-pointer disabled:opacity-[var(--control-disabled-opacity)] disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
        >
            <span className="text-label-2 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-brand-accent transition-colors duration-quick">{icon}</span>
            <span className="flex-1 text-sm font-semibold text-label-1">{label}</span>
            {value && <span className="text-xs text-label-2 min-w-0 max-w-[45%]">
                <span className="sr-only">{value}</span>
                <span aria-hidden="true" className="block truncate">
                    <IconSwap swapKey={value} subtle>{value}</IconSwap>
                </span>
            </span>}
            {rightElement || (
                <IconNavigationChevronLeft className="w-4 h-4 rotate-180 text-label-3 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-label-2 transition-[color,transform] duration-quick ease-smooth-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5 motion-safe:group-focus-visible:translate-x-0.5 shrink-0" />
            )}
        </button>
    )
}
