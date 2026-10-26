import * as React from "react"
import { Popover } from "@/components/ui/popover"
import { Button, IconButton } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { IconMediaPlay, IconUiMoreHorizontal } from "@/components/ui/icons"

interface PrimaryPlayButtonProps {
    label: string
    /** Texto chico al lado (ej. "quedan 10 min"). */
    detail?: string | null
    onClick: () => void
    /** Hover o foco: el servidor calienta el archivo antes del clic. */
    onHoverIntent?: () => void
    /**
     * Etiquetas que puede llegar a mostrar: se apilan invisibles en la misma
     * celda para reservar el ancho de la más larga, así el botón (y las
     * acciones de su fila) no se corren al cambiar la etiqueta.
     */
    reserveLabels?: readonly string[]
    className?: string
}

/** El único botón principal de la ficha: pastilla blanca de 48 px. */
export function PrimaryPlayButton({ label, detail, onClick, onHoverIntent, reserveLabels, className }: PrimaryPlayButtonProps) {
    // El fundido de la etiqueta solo corre al cambiar, no al montar (la fila ya entra con su propia animación).
    const [prevLabel, setPrevLabel] = React.useState(label)
    const [labelSwapped, setLabelSwapped] = React.useState(false)
    if (label !== prevLabel) {
        setPrevLabel(label)
        setLabelSwapped(true)
    }
    return (
        <Button
            intent="primary"
            size="lg"
            onClick={onClick}
            onPointerEnter={onHoverIntent}
            onFocus={onHoverIntent}
            leftIcon={<IconMediaPlay className="h-5 w-5 fill-current" aria-hidden="true" />}
            className={cn("min-w-[9rem] font-bold", className)}
        >
            <span className="inline-grid">
                {reserveLabels?.map(l => (
                    <span key={`reserve-${l}`} aria-hidden="true" className="invisible col-start-1 row-start-1">{l}</span>
                ))}
                <span key={label} className={cn("col-start-1 row-start-1 truncate", labelSwapped && "animate-text-swap-in")}>{label}</span>
            </span>
            {detail && <span className="ml-1.5 hidden font-medium opacity-60 tabular-nums sm:inline">· {detail}</span>}
        </Button>
    )
}

interface RoundActionProps {
    label: string
    icon: React.ReactNode
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
    /** Para toggles (Mi Lista, Vista): se anuncia como botón presionado. */
    pressed?: boolean
    disabled?: boolean
    "aria-busy"?: React.AriaAttributes["aria-busy"]
    className?: string
}

/** Acción secundaria: círculo de 44 px con nombre accesible y tooltip nativo. */
export const RoundAction = React.forwardRef<HTMLButtonElement, RoundActionProps>(function RoundAction(
    { label, icon, onClick, pressed, className, ...rest },
    ref
) {
    return (
        <IconButton
            ref={ref}
            intent="glass"
            aria-label={label}
            aria-pressed={pressed}
            title={label}
            onClick={onClick}
            icon={icon}
            // 44 px también con puntero fino: acá es una acción principal, no cromo compacto.
            className={cn("h-11 w-11 [@media(hover:hover)_and_(pointer:fine)]:h-11 [@media(hover:hover)_and_(pointer:fine)]:w-11", pressed && "bg-[var(--neutral-elev-2)]", className)}
            {...rest}
        />
    )
})

interface MoreActionItem {
    label: string
    icon?: React.ReactNode
    onSelect: () => void
}

/** "Más": las acciones de poco uso, fuera de la fila principal. */
export function MoreActionsMenu({ items, label = "Más opciones" }: { items: MoreActionItem[]; label?: string }) {
    const [open, setOpen] = React.useState(false)
    const firstActionRef = React.useRef<HTMLButtonElement>(null)
    if (items.length === 0) return null
    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            align="start"
            onOpenAutoFocus={(event) => {
                event.preventDefault()
                firstActionRef.current?.focus()
            }}
            // Radix lo expone como role="dialog": sin nombre, axe marca aria-dialog-name.
            aria-label={label}
            className="w-60 p-1.5"
            trigger={
                <RoundAction
                    label={label}
                    icon={<IconUiMoreHorizontal className="h-5 w-5" />}
                    // El Trigger de Radix ya abre y cierra: acá no se duplica el toggle.
                    onClick={() => { }}
                />
            }
        >
            <ul className="flex flex-col">
                {items.map((item, index) => (
                    <li key={item.label}>
                        <button
                            ref={index === 0 ? firstActionRef : undefined}
                            type="button"
                            onClick={() => {
                                setOpen(false)
                                item.onSelect()
                            }}
                            className={cn(
                                "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left type-label text-on-surface",
                                "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-2)] focus-visible:bg-[var(--neutral-elev-2)] outline-none cursor-pointer"
                            )}
                        >
                            {item.icon && <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center text-on-surface-variant">{item.icon}</span>}
                            {item.label}
                        </button>
                    </li>
                ))}
            </ul>
        </Popover>
    )
}

/** Progreso de "Continuar" debajo de las acciones: barra fina + texto. */
export function ResumeProgress({ percent, label }: { percent: number; label: string }) {
    const value = Math.min(100, Math.max(0, Math.round(percent)))
    return (
        <div className="flex items-center gap-3">
            <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value}
                aria-label="Progreso"
                className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"
            >
                {/* scaleX en vez de width: el avance al volver del reproductor se anima en el
                    compositor. Sin rounded-full: la pista ya recorta con overflow-hidden. */}
                <div
                    className="h-full w-full origin-left bg-white transition-transform duration-slow ease-smooth-out"
                    style={{ transform: `scaleX(${value / 100})` }}
                />
            </div>
            <span className="type-caption text-on-surface/80 tabular-nums shrink-0">{label}</span>
        </div>
    )
}
