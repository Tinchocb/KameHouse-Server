import type { Transition } from "framer-motion";

/** Para pills activas, toggles y layoutId deslizantes */
export const SPRING_PILL: Transition = {
    type: "spring",
    stiffness: 480,
    damping: 34,
    mass: 1,
};

/** Para snap-back de SlideToConfirm y rebotes de drag */
export const SPRING_SNAP: Transition = {
    type: "spring",
    stiffness: 500,
    damping: 38,
    mass: 0.8,
};

