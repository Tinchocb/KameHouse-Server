"use client"

import * as React from "react"
import {
    m,
    useMotionValue,
    useTransform,
    useReducedMotion,
    animate,
} from "framer-motion"
import { CheckCircle2, AlertTriangle } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { SPRING_SNAP } from "@/components/ui/core/motion"

// ─── Constants ────────────────────────────────────────────────────────────────

const THUMB_SIZE = 40          // px
const TRACK_HEIGHT = 44        // px — touch target mínimo
const CONFIRM_THRESHOLD = 0.88 // 88% del recorrido para confirmar

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "dragging" | "confirming" | "success" | "error"
type Variant = "destructive" | "warning"

export interface SlideToConfirmProps {
    /** Texto del track en reposo */
    label: string
    /** Texto al confirmar con éxito */
    confirmLabel?: string
    /** Acción asíncrona a ejecutar tras el slide */
    onConfirm: () => Promise<void>
    disabled?: boolean
    variant?: Variant
    className?: string
}

// ─── Palette map ──────────────────────────────────────────────────────────────

const PALETTE = {
    destructive: {
        track:        "border border-red-500/25 border-t-red-400/30 bg-red-950/40",
        fill:         "bg-red-500/20",
        thumb:        "bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.45)]",
        thumbIcon:    "text-white",
        label:        "text-red-400/70",
        successTrack: "border border-emerald-500/30 bg-emerald-950/30",
        successThumb: "bg-emerald-500 shadow-[0_0_14px_rgba(34,197,94,0.45)]",
    },
    warning: {
        track:        "border border-amber-500/25 border-t-amber-400/30 bg-amber-950/40",
        fill:         "bg-amber-500/20",
        thumb:        "bg-amber-500 shadow-[0_0_14px_rgba(245,158,11,0.45)]",
        thumbIcon:    "text-white",
        label:        "text-amber-400/70",
        successTrack: "border border-emerald-500/30 bg-emerald-950/30",
        successThumb: "bg-emerald-500 shadow-[0_0_14px_rgba(34,197,94,0.45)]",
    },
} satisfies Record<Variant, {
    track: string; fill: string; thumb: string; thumbIcon: string; label: string
    successTrack: string; successThumb: string
}>

// ─── Inline icon: double chevron right ───────────────────────────────────────

function ChevronRightDouble({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            <path d="M4 3l5 5-5 5" />
            <path d="M8 3l5 5-5 5" />
        </svg>
    )
}

// ─── Reduced-motion fallback: botón de confirmación directo ──────────────────

function ReducedMotionFallback({
    label,
    confirmLabel,
    onConfirm,
    disabled,
    palette,
    className,
}: {
    label: string
    confirmLabel: string
    onConfirm: () => Promise<void>
    disabled: boolean
    variant: Variant
    palette: typeof PALETTE[Variant]
    className?: string
}) {
    const [phase, setPhase] = React.useState<"idle" | "confirming" | "success" | "error">("idle")

    const handleClick = async () => {
        if (phase !== "idle") return
        setPhase("confirming")
        try {
            await onConfirm()
            setPhase("success")
            setTimeout(() => setPhase("idle"), 2400)
        } catch {
            setPhase("error")
            setTimeout(() => setPhase("idle"), 1200)
        }
    }

    const isSuccess = phase === "success"

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled || phase !== "idle"}
            className={cn(
                "relative flex items-center justify-center gap-2 rounded-full px-4",
                "text-3xs font-black uppercase tracking-widest font-mono",
                "transition-colors duration-150 active:scale-95",
                isSuccess
                    ? cn(palette.successTrack, "text-emerald-400")
                    : cn(palette.track, palette.label),
                "disabled:opacity-60 disabled:pointer-events-none",
                className
            )}
            style={{ height: TRACK_HEIGHT, minWidth: 200 }}
        >
            {phase === "confirming" && (
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            {isSuccess ? confirmLabel : phase === "confirming" ? "Confirmando..." : label}
        </button>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * @deprecated Usar `HoldConfirm` de `@/components/ui/kinetics` (mantener presionado 800ms) en su lugar.
 */
export function SlideToConfirm({
    label,
    confirmLabel = "Confirmado",
    onConfirm,
    disabled = false,
    variant = "destructive",
    className,
}: SlideToConfirmProps) {
    const prefersReducedMotion = useReducedMotion()
    const trackRef = React.useRef<HTMLDivElement>(null)

    const [phase, setPhase] = React.useState<Phase>("idle")
    const [trackWidth, setTrackWidth] = React.useState(0)

    const dragX = useMotionValue(0)
    // 4px padding a cada lado del thumb dentro del track
    const maxDrag = Math.max(0, trackWidth - THUMB_SIZE - 8)

    // Progreso normalizado 0→1
    const progress = useTransform(dragX, [0, maxDrag], [0, 1])
    // Fill bar: escala el ancho completo del track
    const fillScaleX = useTransform(dragX, [0, maxDrag], [0, 1])
    // Label se desvanece cuando el thumb avanza
    const labelOpacity = useTransform(progress, [0, 0.45], [1, 0])

    const palette = PALETTE[variant]
    const isSuccess = phase === "success"
    const isConfirming = phase === "confirming"
    const isError = phase === "error"
    const isLocked = disabled || isConfirming || isSuccess

    // Medir el track y observar cambios de tamaño
    React.useLayoutEffect(() => {
        const el = trackRef.current
        if (!el) return
        const ro = new ResizeObserver(([entry]) => {
            setTrackWidth(entry.contentRect.width)
        })
        ro.observe(el)
        setTrackWidth(el.getBoundingClientRect().width)
        return () => ro.disconnect()
    }, [])

    // Volver al inicio con spring
    const snapBack = React.useCallback(() => {
        animate(dragX, 0, SPRING_SNAP)
        setPhase("idle")
    }, [dragX])

    // Al soltar el thumb
    const handleDragEnd = React.useCallback(async () => {
        const p = progress.get()
        if (p < CONFIRM_THRESHOLD) {
            snapBack()
            return
        }
        animate(dragX, maxDrag, SPRING_SNAP)
        setPhase("confirming")
        try {
            await onConfirm()
            setPhase("success")
            setTimeout(() => {
                animate(dragX, 0, SPRING_SNAP)
                setPhase("idle")
            }, 2400)
        } catch {
            setPhase("error")
            setTimeout(snapBack, 1200)
        }
    }, [progress, maxDrag, dragX, onConfirm, snapBack])

    // Confirmación por teclado: Enter / Espacio completan el slide
    const handleThumbKeyDown = React.useCallback(
        (e: React.KeyboardEvent) => {
            if (isLocked) return
            if (e.key === "ArrowRight") {
                const next = Math.min(dragX.get() + maxDrag * 0.12, maxDrag)
                animate(dragX, next, { duration: 0.08 })
            }
            if (e.key === "ArrowLeft") {
                const next = Math.max(dragX.get() - maxDrag * 0.12, 0)
                animate(dragX, next, { duration: 0.08 })
            }
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                animate(dragX, maxDrag, SPRING_SNAP)
                void handleDragEnd()
            }
        },
        [isLocked, dragX, maxDrag, handleDragEnd]
    )

    // ── Reduced-motion: botón directo ────────────────────────────────────────
    if (prefersReducedMotion) {
        return (
            <ReducedMotionFallback
                label={label}
                confirmLabel={confirmLabel}
                onConfirm={onConfirm}
                disabled={disabled}
                variant={variant}
                palette={palette}
                className={className}
            />
        )
    }

    // ── Label texto dinámico ─────────────────────────────────────────────────
    const trackLabel = isSuccess
        ? confirmLabel
        : isError
        ? "Error — intentá de nuevo"
        : isConfirming
        ? "Confirmando..."
        : label

    return (
        <div
            ref={trackRef}
            role="group"
            aria-label={`Deslizá para confirmar: ${label}`}
            className={cn(
                "relative flex items-center select-none overflow-hidden rounded-full px-1",
                isSuccess ? palette.successTrack : palette.track,
                isLocked && "opacity-80 pointer-events-none",
                className
            )}
            style={{ height: TRACK_HEIGHT }}
        >
            {/* Fill bar */}
            <m.div
                aria-hidden="true"
                className={cn(
                    "absolute inset-y-0 left-0 origin-left rounded-full",
                    palette.fill
                )}
                style={{ scaleX: fillScaleX, width: "100%" }}
            />

            {/* Track label */}
            <m.span
                aria-hidden="true"
                style={{ opacity: labelOpacity }}
                className={cn(
                    "absolute inset-0 flex items-center justify-center pointer-events-none",
                    "text-3xs font-black uppercase tracking-widest font-mono",
                    isSuccess
                        ? "text-emerald-400"
                        : isError
                        ? "text-red-300"
                        : palette.label
                )}
            >
                {trackLabel}
            </m.span>

            {/* Thumb */}
            <m.div
                role="slider"
                tabIndex={isLocked ? -1 : 0}
                aria-valuenow={Math.round(progress.get() * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={label}
                aria-disabled={isLocked || undefined}
                drag={isLocked ? false : "x"}
                dragConstraints={{ left: 0, right: maxDrag }}
                dragElastic={0.04}
                dragMomentum={false}
                onDragStart={() => setPhase("dragging")}
                onDragEnd={handleDragEnd}
                onKeyDown={handleThumbKeyDown}
                whileTap={{ scale: 0.93 }}
                style={{
                    x: dragX,
                    width: THUMB_SIZE,
                    height: THUMB_SIZE,
                    zIndex: 1,
                    touchAction: "none",
                }}
                className={cn(
                    "relative flex items-center justify-center rounded-full",
                    "cursor-grab active:cursor-grabbing shrink-0",
                    isSuccess ? palette.successThumb : palette.thumb
                )}
            >
                {isSuccess ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                ) : isError ? (
                    <AlertTriangle className="w-4 h-4 text-white" />
                ) : isConfirming ? (
                    <m.div
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                    />
                ) : (
                    <ChevronRightDouble className={cn("w-4 h-4", palette.thumbIcon)} />
                )}
            </m.div>
        </div>
    )
}
