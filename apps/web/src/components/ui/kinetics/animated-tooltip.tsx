import * as React from "react"
import { m, AnimatePresence } from "framer-motion"
import { useReducedMotion } from "./hooks"
import { cn } from "@/components/ui/core/styling"

interface AnimatedTooltipProps {
    content: React.ReactNode
    children: React.ReactNode
    side?: "top" | "bottom" | "left" | "right"
}

export function AnimatedTooltip({
    content,
    children,
    side = "top",
}: AnimatedTooltipProps) {
    const [isVisible, setIsVisible] = React.useState(false)
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const hoveredRef = React.useRef(false)
    const focusedRef = React.useRef(false)
    const tooltipId = React.useId()
    const prefersReducedMotion = useReducedMotion()
    // Un toque no debe dejar el tooltip abierto: en táctil no hay "salir con el cursor", y el
    // mouseenter/focus que dispara el toque quedaba pegado hasta tocar otra cosa (A-10).
    const lastPointerWasTouchRef = React.useRef(false)

    const handleMouseEnter = () => {
        if (timerRef.current !== null) return
        timerRef.current = setTimeout(() => {
            timerRef.current = null
            setIsVisible(true)
        }, 120)
    }

    const hide = React.useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
        setIsVisible(false)
    }, [])

    const handleMouseLeave = () => {
        if (!hoveredRef.current && !focusedRef.current) hide()
    }

    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            lastPointerWasTouchRef.current = false
            if (e.key === "Escape" && (isVisible || timerRef.current !== null)) {
                hide()
                e.stopPropagation()
            }
        }
        document.addEventListener("keydown", onKeyDown, true)
        return () => document.removeEventListener("keydown", onKeyDown, true)
    }, [hide, isVisible])

    React.useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    if (!content) return <>{children}</>

    const initialOffset = {
        top: { y: 6 },
        bottom: { y: -6 },
        left: { x: 6 },
        right: { x: -6 },
    }[side]

    const exitOffset = {
        top: { y: 4 },
        bottom: { y: -4 },
        left: { x: 4 },
        right: { x: -4 },
    }[side]

    const positionClass = {
        top: "-top-9 left-1/2 -translate-x-1/2",
        bottom: "-bottom-9 left-1/2 -translate-x-1/2",
        left: "right-[calc(100%+10px)] top-1/2 -translate-y-1/2",
        right: "left-[calc(100%+10px)] top-1/2 -translate-y-1/2",
    }[side]

    return (
        <div
            role="group"
            className="relative inline-flex items-center justify-center"
            onPointerDown={(e) => {
                lastPointerWasTouchRef.current = e.pointerType === "touch"
                if (lastPointerWasTouchRef.current) {
                    hoveredRef.current = false
                    focusedRef.current = false
                    hide()
                }
            }}
            onPointerEnter={(e) => {
                if (e.pointerType !== "touch") {
                    hoveredRef.current = true
                    handleMouseEnter()
                }
            }}
            onPointerLeave={(e) => {
                if (e.pointerType !== "touch") {
                    hoveredRef.current = false
                    handleMouseLeave()
                }
            }}
            onFocus={() => {
                if (!lastPointerWasTouchRef.current) {
                    focusedRef.current = true
                    handleMouseEnter()
                }
            }}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    focusedRef.current = false
                    handleMouseLeave()
                }
            }}
        >
            {React.isValidElement<{ "aria-describedby"?: string }>(children)
                ? React.cloneElement(children, {
                    "aria-describedby": [children.props["aria-describedby"], isVisible ? tooltipId : undefined].filter(Boolean).join(" ") || undefined,
                })
                : children}
            <AnimatePresence>
                {isVisible && (
                    <m.div
                        id={tooltipId}
                        role="tooltip"
                        aria-hidden={!isVisible}
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, ...initialOffset, scale: 0.95 }}
                        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, scale: 1 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, ...exitOffset, scale: 0.95 }}
                        // Tween de tokens (animation.css: "tooltip appear"): --duration-quick + --ease-out.
                        // Antes, un spring suelto 420/28 fuera de los presets.
                        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                        className={cn(
                            "absolute pointer-events-none z-50 px-2.5 py-1 rounded-xl",
                            "sectionbar",
                            "text-on-surface text-xs font-medium",
                            "whitespace-nowrap select-none",
                            positionClass
                        )}
                    >
                        {content}
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    )
}

AnimatedTooltip.displayName = "AnimatedTooltip"
