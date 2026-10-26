import { Status } from "@/api/generated/types"
import { useGettingStarted } from "@/api/hooks/settings.hooks"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { Button } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { getDefaultSettings, gettingStartedSchema } from "@/lib/server/settings"
import React from "react"
import { IconNavigationHome, IconNavigationRocket } from "@/components/ui/icons"
import { toast } from "sonner"
import { useNavigate } from "@tanstack/react-router"
import { usePlayerStore } from "@/lib/store"
import { LibraryStep } from "@/components/shared/getting-started-steps/library-step"
import { AnimatePresence, m } from "framer-motion"
import { useReducedMotion } from "@/components/ui/kinetics/hooks"

/* ---------------- GETTING STARTED: un solo paso obligatorio ----------------
   Sólo se pregunta dónde están los episodios. Motor de vídeo (FFmpeg), reproducción
   e idioma salen con valores por defecto razonables (o lo ya guardado) y se ofrecen
   después como sugerencias opcionales en el Inicio vacío (ver LibraryEmptyState). */
export function GettingStarted({
    status,
    onClose,
    isModal = false,
    embedded = false,
}: {
    status: Status
    onClose?: () => void
    isModal?: boolean
    embedded?: boolean
}) {
    const { mutate: mutateStart, isPending } = useGettingStarted()
    const navigate = useNavigate()
    const reduceMotion = useReducedMotion()
    const currentSettings = status?.settings
    const hasSavedSettings = !!currentSettings?.id

    const [paths, setPaths] = React.useState<string[]>(() => currentSettings?.library?.seriesPaths ?? [])

    // El player lee marathon/tvMode del store local, no del servidor:
    // sincronizar al guardar para no quedar divergente hasta pasar por Ajustes.
    const syncLocalPlaybackModes = (lib: { marathonMode?: boolean; tvMode?: boolean } | undefined) => {
        try {
            const st = usePlayerStore.getState()
            st.setMarathonMode?.(lib?.marathonMode ?? currentSettings?.library?.marathonMode ?? false)
            st.setTvMode?.(lib?.tvMode ?? currentSettings?.library?.tvMode ?? false)
        } catch {}
    }

    const handleGoToHome = () => {
        if (onClose) {
            onClose()
        }
        navigate({ to: "/home" })
        if (window.location.pathname !== "/home") {
            window.location.href = "/home"
        }
    }

    const addPath = (path: string) => setPaths(prev => (prev.includes(path) ? prev : [...prev, path]))
    const removePath = (path: string) => setPaths(prev => prev.filter(p => p !== path))

    const canContinue = paths.length > 0

    const handleSave = () => {
        if (!canContinue) return
        const lib = currentSettings?.library
        // Valores por defecto razonables para lo que ya no se pregunta; si había
        // ajustes guardados se respetan (el onboarding no pisa nada).
        const data = gettingStartedSchema.parse({
            enableTranscode: currentSettings?.mediastream?.transcodeEnabled ?? false,
            mediaPlayer: currentSettings?.mediaPlayer || {},
            library: {
                enableRichPresence: false,
                enableWatchContinuity: lib?.enableWatchContinuity ?? true,
                autoDetectSkipTimes: lib?.autoDetectSkipTimes ?? true,
                autoPlayNextEpisode: lib?.autoPlayNextEpisode ?? true,
                autoScan: lib?.autoScan ?? false,
                seriesPaths: paths,
                moviePaths: lib?.moviePaths ?? [],
                disableLocalScanning: lib?.disableLocalScanning ?? false,
                disableCloudSource: lib?.disableCloudSource ?? false,
                tmdbApiKey: lib?.tmdbApiKey || "",
                scannerProvider: lib?.scannerProvider || "tmdb",
                tmdbLanguage: lib?.tmdbLanguage || "es-MX",
            },
            notifications: {
                disableNotifications: currentSettings?.notifications?.disableNotifications ?? false,
                disableAutoScannerNotifications: currentSettings?.notifications?.disableAutoScannerNotifications ?? false,
            },
        })
        const payload = getDefaultSettings(data, currentSettings)

        mutateStart(payload, {
            onSuccess: () => {
                syncLocalPlaybackModes(data.library)
                toast.success("Carpeta guardada. Ya puedes explorar KameHouse.")
                handleGoToHome()
            },
            onError: () => {
                toast.error("No se pudo guardar la carpeta", { description: "Inténtalo de nuevo." })
            },
        })
    }

    // Pantalla completa: es el contenido principal de la página (axe landmark-one-main / region).
    const Root = embedded || isModal ? "div" : "main"

    // Formulario y overlay de carga se alternan con AnimatePresence (mode="wait"): el formulario
    // sale con un fundido corto (80 ms) y el overlay sale con el suyo (150 ms) antes de que entre el contenido.
    const content = (
        <m.div key="content" className="w-full" exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.08 } }}>
            <Root className={cn(
                "w-full bg-bg-primary relative flex flex-col justify-between select-none overflow-hidden",
                embedded ? "rounded-2xl border border-[var(--neutral-separator)] p-4 sm:p-6" : isModal ? "p-4 sm:p-6" : "min-h-[100dvh] h-[100dvh]"
            )}>
                {/* Fondo: velo fijo con tres colores de era desde las esquinas, sin orbes
                    flotantes (misma línea que el fondo del Modo por Era). */}
                <div
                    aria-hidden
                    className="absolute inset-0 overflow-hidden pointer-events-none"
                    style={{
                        background: [
                            "radial-gradient(90% 70% at 0% 0%, color-mix(in srgb, var(--era-db-hex) 14%, transparent), transparent 60%)",
                            "radial-gradient(80% 65% at 100% 0%, color-mix(in srgb, var(--era-dbz-hex) 10%, transparent), transparent 60%)",
                            "radial-gradient(90% 70% at 100% 100%, color-mix(in srgb, var(--era-dbgt-hex) 10%, transparent), transparent 60%)",
                        ].join(", "),
                    }}
                />

                {/* Top header bar */}
                {!isModal && !embedded && (
                    <div className="w-full relative z-10 px-4 sm:px-8 pt-4 sm:pt-6 flex justify-between items-center border-b border-[var(--neutral-separator)] pb-3">
                        <span className="font-display text-lg sm:text-xl font-bold text-on-surface">
                            KameHouse
                        </span>

                        {/* Con ajustes ya guardados el paso no es obligatorio: se puede volver. */}
                        {hasSavedSettings && (
                            <Button
                                type="button"
                                size="sm"
                                intent="outline"
                                onClick={handleGoToHome}
                                leftIcon={<IconNavigationHome className="w-3.5 h-3.5" />}
                            >
                                Ir al Inicio
                            </Button>
                        )}
                    </div>
                )}

                {/* Middle scrollable content */}
                <div className="w-full flex-1 overflow-y-auto relative z-10 px-4 sm:px-8 py-3 sm:py-5 flex flex-col justify-center items-center">
                    <div className="w-full max-w-2xl">
                        <LibraryStep paths={paths} onAdd={addPath} onRemove={removePath} />
                    </div>
                </div>

                {/* Bottom action bar */}
                <div className="w-full relative z-20 bg-surface/90 backdrop-blur-overlay-md border-t border-[var(--neutral-separator)] px-4 sm:px-8 py-3.5 flex justify-between items-center gap-3 max-w-3xl mx-auto rounded-t-2xl shadow-modal mt-2">
                    <p id="getting-started-hint" className="text-xs text-on-surface-variant min-w-0">
                        {canContinue
                            ? "Podrás ajustar el resto cuando quieras desde Ajustes."
                            : "Añade al menos una carpeta para continuar."}
                    </p>
                    <Button
                        type="button"
                        intent="primary"
                        size="sm"
                        onClick={handleSave}
                        disabled={!canContinue}
                        aria-describedby="getting-started-hint"
                        className="shrink-0 px-6"
                        loading={isPending}
                        rightIcon={<IconNavigationRocket className="w-4 h-4" />}
                    >
                        Guardar y continuar
                    </Button>
                </div>
            </Root>
        </m.div>
    )

    return (
        <AnimatePresence mode="wait" initial={false}>
            {isPending ? <LoadingOverlayWithLogo key="loader" /> : content}
        </AnimatePresence>
    )
}
