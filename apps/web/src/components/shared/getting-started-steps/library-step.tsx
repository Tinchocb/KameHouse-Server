import { Field } from "@/components/ui/form"
import { m } from "framer-motion"
import { containerVariants, itemVariants } from "./variants"
import { StepCard } from "./step-chrome"

/* ---------------- STEP 1: BIBLIOTECA ---------------- */
export function LibraryStep() {
    return (
        <m.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-4 max-w-2xl mx-auto"
        >
            <m.div variants={itemVariants} className="text-center space-y-1">
                <h2 className="text-xl sm:text-2xl font-display tracking-wide text-on-surface uppercase">
                    1. Biblioteca y Rutas de Archivos
                </h2>
                <p className="text-on-surface-variant text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                    Indica las carpetas de tu equipo donde guardas tus animes. KameHouse escaneará y organizará automáticamente los episodios y sagas.
                </p>
            </m.div>

            <StepCard>
                <m.div variants={itemVariants} className="space-y-4">
                    <Field.MultiDirectorySelector
                        name="library.seriesPaths"
                        label="Carpetas de Series de Anime"
                        help="Ubicaciones con episodios organizados por series, sagas o temporadas."
                        shouldExist
                    />

                    <div className="h-[1px] bg-border-subtle" />

                    <Field.MultiDirectorySelector
                        name="library.moviePaths"
                        label="Carpetas de Películas y OVAs"
                        help="Ubicaciones que contienen películas individuales, especiales o películas animadas."
                        shouldExist
                    />
                </m.div>
            </StepCard>
        </m.div>
    )
}
