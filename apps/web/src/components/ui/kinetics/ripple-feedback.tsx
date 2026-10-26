import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { useMotionTier } from "./hooks"

interface RippleFeedbackProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    rippleColor?: string
    children: React.ReactNode
}

interface Ripple {
    id: number
    x: number
    y: number
    size: number
}

/**
 * Botón nativo con onda en el punto de pulsación. La onda nace al presionar
 * (pointerdown), no al soltar. Enter/Espacio los resuelve el navegador (click con
 * detail 0): en ese caso la onda nace en el centro. Solo con el tier "full".
 */
export const RippleFeedback = React.forwardRef<HTMLButtonElement, RippleFeedbackProps>(
    ({ rippleColor, children, className, onClick, onPointerDown, type = "button", ...props }, ref) => {
        const tier = useMotionTier()
        const [ripples, setRipples] = React.useState<Ripple[]>([])
        const nextIdRef = React.useRef(0)

        const spawnRipple = (button: HTMLButtonElement, point: { x: number; y: number } | null) => {
            if (tier !== "full") return
            const rect = button.getBoundingClientRect()
            const x = point ? point.x - rect.left : rect.width / 2
            const y = point ? point.y - rect.top : rect.height / 2
            // Diámetro que cubre el botón entero desde cualquier punto de partida.
            const size = 2 * Math.hypot(rect.width, rect.height)
            const id = nextIdRef.current++
            setRipples((prev) => [...prev, { id, x, y, size }])
        }

        const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
            if (e.button === 0 && !e.currentTarget.disabled) {
                spawnRipple(e.currentTarget, { x: e.clientX, y: e.clientY })
            }
            onPointerDown?.(e)
        }

        const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
            // Teclado: el click llega con detail 0 y sin pointerdown previo.
            if (e.detail === 0) spawnRipple(e.currentTarget, null)
            onClick?.(e)
        }

        const removeRipple = (id: number) => {
            setRipples((prev) => prev.filter((r) => r.id !== id))
        }

        return (
            <button
                ref={ref}
                type={type}
                className={cn("relative overflow-hidden", className)}
                onPointerDown={handlePointerDown}
                onClick={handleClick}
                {...props}
            >
                {children}
                {ripples.map((ripple) => (
                    <span
                        key={ripple.id}
                        aria-hidden="true"
                        onAnimationEnd={() => removeRipple(ripple.id)}
                        // Crece de 0 a su tamaño y se apaga (opacity-0 es el estado final):
                        // una sola pasada de --duration-slow con --ease-out.
                        className="absolute rounded-full pointer-events-none opacity-0 animate-in zoom-in fade-in-100 duration-slow ease-out-strong motion-reduce:hidden"
                        style={{
                            left: ripple.x - ripple.size / 2,
                            top: ripple.y - ripple.size / 2,
                            width: ripple.size,
                            height: ripple.size,
                            backgroundColor: rippleColor || "rgba(255, 255, 255, 0.3)",
                        }}
                    />
                ))}
            </button>
        )
    }
)

RippleFeedback.displayName = "RippleFeedback"
