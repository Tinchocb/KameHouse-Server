import { useGetFFmpegStatus } from "@/api/hooks/mediastream.hooks"
import { DirectorySelector } from "@/components/shared/directory-selector"
import { Button, IconButton } from "@/components/ui/button"
import { IconStatusFolder, IconStatusFolderOpen, IconUiCheckCircle, IconUiDelete, IconUiPlus, IconUiSpinner } from "@/components/ui/icons"
import { __isDesktop__ } from "@/types/constants"
import { AnimatePresence, m } from "framer-motion"
import React from "react"
import { StepCard } from "./step-chrome"
import { containerVariants, itemVariants } from "./variants"
import { useReducedMotion, useSpringPreset } from "@/components/ui/kinetics/hooks"

// Salida de una carpeta quitada: --duration-quick con --ease-out, más corta que la entrada.
const ROW_EXIT_TRANSITION = { duration: 0.15, ease: [0.23, 1, 0.32, 1] } as const

// Etiqueta del botón de añadir: "Añadir carpeta" la primera vez, "Añadir otra carpeta" después.
export const addFolderLabel = (count: number) => (count === 0 ? "Añadir carpeta" : "Añadir otra carpeta")

// ÚNICO PASO OBLIGATORIO: ¿DÓNDE ESTÁN TUS EPISODIOS?
export function LibraryStep({
    paths,
    onAdd,
    onRemove,
    onChooseDrive,
}: {
    paths: string[]
    onChooseDrive: () => void
    onAdd: (path: string) => void
    onRemove: (path: string) => void
}) {
    const [draft, setDraft] = React.useState("")
    const [isPicking, setIsPicking] = React.useState(false)
    const rowSpring = useSpringPreset("entrance")
    const reduceMotion = useReducedMotion()

    const addDraft = () => {
        const path = draft.trim()
        if (!path) return
        onAdd(path)
        setDraft("")
    }

    // Desktop: el diálogo nativo añade la carpeta en un solo gesto.
    const pickNative = async () => {
        setIsPicking(true)
        try {
            const { open } = await import("@tauri-apps/plugin-dialog")
            const selected = await open({ directory: true, multiple: false, title: "¿Dónde están tus episodios?" })
            if (typeof selected === "string" && selected) onAdd(selected)
        } catch {
            // Sin plugin nativo: queda el campo de texto de abajo.
        } finally {
            setIsPicking(false)
        }
    }

    return (
        <m.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-5 max-w-xl mx-auto">
            <m.div variants={itemVariants} className="text-center space-y-2">
                <h1 className="text-2xl sm:text-3xl font-display text-on-surface">
                    Configura tu biblioteca
                </h1>
                <p className="text-on-surface-variant text-sm max-w-md mx-auto leading-relaxed">
                    Elige dónde guardas tus series y películas. Después puedes añadir otra fuente desde Ajustes.
                </p>
            </m.div>

            <StepCard>
                <m.div variants={itemVariants} className="space-y-4">
                    <h2 className="font-semibold text-on-surface">Carpetas locales</h2>
                    {__isDesktop__ && (
                        <Button
                            intent="secondary"
                            size="lg"
                            onClick={pickNative}
                            disabled={isPicking}
                            leftIcon={isPicking ? <IconUiSpinner className="w-4 h-4 animate-spin" /> : <IconStatusFolderOpen className="w-4 h-4" />}
                            iconSpacing="0.5rem"
                            className="w-full"
                        >
                            Elegir carpeta
                        </Button>
                    )}

                    <div className="space-y-2">
                        {__isDesktop__ && <p className="text-xs text-on-surface-variant">O escribe la ruta a mano:</p>}
                        <DirectorySelector
                            value={draft}
                            onSelect={setDraft}
                            shouldExist
                            placeholder="D:\Anime"
                            aria-label="Ruta de la carpeta de episodios"
                            trailingAction={
                                <Button
                                    intent="outline"
                                    size="sm"
                                    onClick={addDraft}
                                    disabled={!draft.trim()}
                                    leftIcon={<IconUiPlus className="w-3.5 h-3.5" />}
                                    iconSpacing="0.375rem"
                                    className="shrink-0"
                                >
                                    {addFolderLabel(paths.length)}
                                </Button>
                            }
                        />
                    </div>

                    <AnimatePresence initial={false}>
                        {paths.length > 0 && (
                            // La lista entra y sale entera con la primera y la última carpeta:
                            // el AnimatePresence interno (initial={false}) no anima la fila
                            // con la que se monta. `relative`: popLayout saca la fila que sale
                            // con position absolute dentro de la lista.
                            <m.ul
                                key="paths"
                                layout
                                initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: reduceMotion ? 0 : -6, transition: ROW_EXIT_TRANSITION }}
                                transition={rowSpring}
                                className="relative space-y-2"
                                aria-label="Carpetas añadidas"
                            >
                                <AnimatePresence initial={false} mode="popLayout">
                                    {paths.map(dir => (
                                        <m.li
                                            key={dir}
                                            layout
                                            initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: reduceMotion ? 0 : -6, transition: ROW_EXIT_TRANSITION }}
                                            transition={rowSpring}
                                            className="flex items-center gap-2 rounded-xl border border-[var(--neutral-separator)] bg-surface-container-low pl-3 pr-1 py-1"
                                        >
                                            <IconStatusFolder className="w-4 h-4 shrink-0 text-brand-accent-readable" aria-hidden />
                                            <span className="flex-1 min-w-0 truncate font-mono text-xs text-on-surface" title={dir}>{dir}</span>
                                            <IconButton
                                                intent="ghost"
                                                size="md"
                                                onClick={() => onRemove(dir)}
                                                title="Quitar carpeta"
                                                aria-label={`Quitar carpeta ${dir}`}
                                                className="text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-status-error [@media(hover:hover)_and_(pointer:fine)]:hover:bg-status-error/10"
                                                icon={<IconUiDelete className="w-4 h-4" />}
                                            />
                                        </m.li>
                                    ))}
                                </AnimatePresence>
                            </m.ul>
                        )}
                    </AnimatePresence>
                </m.div>
            </StepCard>

            <StepCard>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="font-semibold text-on-surface">Google Drive</h2>
                        <p className="text-sm text-on-surface-variant">Vincula tu cuenta para reproducir los archivos de tu Drive.</p>
                    </div>
                    <Button intent="secondary" size="md" className="shrink-0" onClick={onChooseDrive}>Configurar Drive</Button>
                </div>
            </StepCard>

            <m.div variants={itemVariants}>
                <EngineDetection />
            </m.div>
        </m.div>
    )
}

// Detección de FFmpeg/FFprobe en segundo plano: informa, nunca bloquea.
function EngineDetection() {
    const { data: status, isLoading } = useGetFFmpegStatus()
    const ready = !!status?.ffmpegAvailable && !!status?.ffprobeAvailable

    return (
        <p role="status" className="flex items-center justify-center gap-2 text-xs text-on-surface-variant text-center">
            {isLoading ? (
                <>
                    <IconUiSpinner className="w-3.5 h-3.5 animate-spin" aria-hidden />
                    Buscando el motor de vídeo (FFmpeg)…
                </>
            ) : ready ? (
                <>
                    <IconUiCheckCircle className="w-3.5 h-3.5 text-status-success" aria-hidden />
                    Motor de vídeo detectado
                </>
            ) : (
                <>Motor de vídeo (FFmpeg) no detectado: podrás instalarlo después con un clic.</>
            )}
        </p>
    )
}
