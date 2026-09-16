import * as React from "react"
import { cn } from "@/components/ui/core/styling"

export interface RippleFeedbackProps extends React.HTMLAttributes<HTMLDivElement> {
    rippleColor?: string
    children: React.ReactNode
}

export const RippleFeedback = React.forwardRef<HTMLDivElement, RippleFeedbackProps>(
    ({ rippleColor, children, className, onClick, ...props }, ref) => {
        const [ripples, setRipples] = React.useState<Array<{ id: number; x: number; y: number }>>([])

        const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            const id = Date.now()

            setRipples((prev) => [...prev, { id, x, y }])
            setTimeout(() => {
                setRipples((prev) => prev.filter((r) => r.id !== id))
            }, 600)

            if (onClick) {
                onClick(e)
            }
        }

        return (
            <div
                ref={ref}
                className={cn("relative overflow-hidden", className)}
                onClick={handleClick}
                {...props}
            >
                {children}
                {ripples.map((ripple) => (
                    <span
                        key={ripple.id}
                        className="absolute rounded-full pointer-events-none animate-ping"
                        style={{
                            left: ripple.x - 10,
                            top: ripple.y - 10,
                            width: 20,
                            height: 20,
                            backgroundColor: rippleColor || "rgba(255, 255, 255, 0.3)",
                        }}
                    />
                ))}
            </div>
        )
    }
)

RippleFeedback.displayName = "RippleFeedback"

export * from "./hooks"
