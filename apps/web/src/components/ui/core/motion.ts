import type { Transition } from "framer-motion";

/** Para pills activas, toggles y layoutId deslizantes */
export const SPRING_PILL: Transition = {
    type: "spring",
    stiffness: 480,
    damping: 34,
    mass: 1,
};
