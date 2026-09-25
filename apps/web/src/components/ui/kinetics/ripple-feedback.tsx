import * as React from "react"
import { cn } from "@/components/ui/core/styling"

export interface RippleFeedbackProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    rippleColor?: string
    children: React.ReactNode
}

/**
 * Botón nativo con onda en el punto de click. Enter/Espacio los resuelve el
 * navegador (click con detail 0): en ese caso la onda nace en el centro.
 */
export const RippleFeedback = React.forwardRef<HTMLButtonElement, RippleFeedbackProps>(
    ({ rippleColor, children, className, onClick, type = "button", ...props }, ref) => {
        const [ripples, setRipples] = React.useState<Array<{ id: number; x: number; y: number }>>([])

        const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const fromKeyboard = e.detail === 0
            const x = fromKeyboard ? rect.width / 2 : e.clientX - rect.left
            const y = fromKeyboard ? rect.height / 2 : e.clientY - rect.top
            const id = Date.now()

            setRipples((prev) => [...prev, { id, x, y }])
            setTimeout(() => {
                setRipples((prev) => prev.filter((r) => r.id !== id))
            }, 600)

            onClick?.(e)
        }

        return (
            <button
                ref={ref}
                type={type}
                className={cn("relative overflow-hidden", className)}
                onClick={handleClick}
                {...props}
            >
                {children}
                {ripples.map((ripple) => (
                    <span
                        key={ripple.id}
                        aria-hidden="true"
                        className="absolute rounded-full pointer-events-none animate-ping motion-reduce:hidden"
                        style={{
                            left: ripple.x - 10,
                            top: ripple.y - 10,
                            width: 20,
                            height: 20,
                            backgroundColor: rippleColor || "rgba(255, 255, 255, 0.3)",
                        }}
                    />
                ))}
            </button>
        )
    }
)

RippleFeedback.displayName = "RippleFeedback"
