import { forwardRef } from "react"
import { m, useIsPresent, type HTMLMotionProps } from "framer-motion"

/** Mantiene el elemento para su salida visual, retirando inmediatamente la interacción. */
export const PresenceSurface = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>((props, ref) => {
    const isPresent = useIsPresent()
    return <m.div {...props} ref={ref} inert={!isPresent || props.inert} aria-hidden={isPresent ? props["aria-hidden"] : true}
        style={{ ...props.style, pointerEvents: isPresent ? props.style?.pointerEvents : "none" }} />
})
PresenceSurface.displayName = "PresenceSurface"
