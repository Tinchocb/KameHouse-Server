/**
 * Funciones de framer-motion (animaciones, gestos, drag y layout/layoutId) en
 * un chunk aparte: fuera del JS inicial. La app usa solo `m` bajo
 * <LazyMotion strict>, así que el componente base no las arrastra.
 */
import { domMax } from "framer-motion"

export default domMax
