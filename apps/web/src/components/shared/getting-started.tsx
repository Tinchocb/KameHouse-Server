import { Status } from "@/api/generated/types"
import { useGettingStarted } from "@/api/hooks/settings.hooks"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { Button } from "@/components/ui/button"
import { buildGettingStartedPayload } from "@/lib/server/settings"
import React from "react"
import { IconNavigationHome, IconNavigationRocket } from "@/components/ui/icons"
import { toast } from "sonner"
import { useNavigate } from "@tanstack/react-router"
import { usePlayerStore } from "@/lib/store"
import { LibraryStep } from "@/components/shared/getting-started-steps/library-step"
import { AnimatePresence, m } from "framer-motion"
import { useReducedMotion } from "@/components/ui/kinetics/hooks"
import { useIsClassicMode } from "@/lib/theme/use-classic-mode"

/* ---------------- GETTING STARTED: un solo paso obligatorio ----------------
   Sólo se pregunta dónde están los episodios. Motor de vídeo (FFmpeg), reproducción
   e idioma salen con valores por defecto razonables (o lo ya guardado) y se ofrecen
   después como sugerencias opcionales en el Inicio vacío (ver LibraryEmptyState). */
export function GettingStarted({
    status,
    onClose,
}: {
    status: Status
    onClose?: () => void
}) {
    const { mutateAsync: saveSetup, isPending } = useGettingStarted()
    const navigate = useNavigate()
    const reduceMotion = useReducedMotion()
    const isClassic = useIsClassicMode()
    const currentSettings = status?.settings
    const canSkipSetup = !status.setupRequired

    const [paths, setPaths] = React.useState<string[]>(() => currentSettings?.library?.seriesPaths ?? [])

    // El player lee maratón del store local, no del servidor:
    // sincronizar al guardar para no quedar divergente hasta pasar por Ajustes.
    const syncLocalPlaybackModes = (lib: { marathonMode?: boolean } | undefined) => {
        try {
            const st = usePlayerStore.getState()
            st.setMarathonMode?.(lib?.marathonMode ?? currentSettings?.library?.marathonMode ?? false)
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

    const handleSave = async (source: "local" | "drive") => {
        if (isPending || (source === "local" && !canContinue)) return
        try {
            // Dentro del try: si la validación falla, el usuario ve el aviso y no un botón que no hace nada.
            const payload = buildGettingStartedPayload({
                current: currentSettings,
                mediastream: status.mediastreamSettings,
                seriesPaths: paths,
            })
            await saveSetup(payload)
            syncLocalPlaybackModes(payload.library)
        } catch {
            toast.error("No se pudo guardar la configuración", { description: "Inténtalo de nuevo." })
            return
        }
        onClose?.()
        if (source === "drive") {
            await navigate({ to: "/settings", search: { tab: "library" }, hash: "google-drive-integration" })
        } else {
            await navigate({ to: "/home" })
        }
    }

    // Formulario y overlay de carga se alternan con AnimatePresence (mode="wait"): el formulario
    // sale con un fundido corto (80 ms) y el overlay sale con el suyo (150 ms) antes de que entre el contenido.
    const content = (
        <m.div key="content" className="w-full" exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.08 } }}>
            <main className="w-full bg-bg-primary relative flex flex-col justify-between select-none overflow-hidden min-h-[100dvh] h-[100dvh]">
                {/* Fondo: velo fijo con tres colores de era desde las esquinas en Modo Era,
                    o gradiente acromático sutil en Modo Neutro (sin orbes flotantes). */}
                <div
                    aria-hidden
                    className="absolute inset-0 overflow-hidden pointer-events-none"
                    style={{
                        background: isClassic
                            ? "radial-gradient(90% 70% at 50% 0%, rgba(255, 255, 255, 0.03), transparent 70%)"
                            : [
                                "radial-gradient(90% 70% at 0% 0%, color-mix(in srgb, var(--era-db-hex) 14%, transparent), transparent 60%)",
                                "radial-gradient(80% 65% at 100% 0%, color-mix(in srgb, var(--era-dbz-hex) 10%, transparent), transparent 60%)",
                                "radial-gradient(90% 70% at 100% 100%, color-mix(in srgb, var(--era-dbgt-hex) 10%, transparent), transparent 60%)",
                            ].join(", "),
                    }}
                />

                {/* Top header bar */}
                <div className="w-full relative z-10 px-4 sm:px-8 pt-4 sm:pt-6 flex justify-between items-center border-b border-[var(--neutral-separator)] pb-3">
                        <span className="font-display text-lg sm:text-xl font-bold text-on-surface">
                            KameHouse
                        </span>

                        {/* Con el asistente ya completado el paso no es obligatorio: se puede volver. */}
                        {canSkipSetup && (
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

                {/* Middle scrollable content */}
                <div className="w-full flex-1 overflow-y-auto relative z-10 px-4 sm:px-8 py-3 sm:py-5 flex flex-col items-center">
                    <div className="w-full max-w-2xl my-auto">
                        <LibraryStep paths={paths} onAdd={addPath} onRemove={removePath} onChooseDrive={() => void handleSave("drive")} />
                    </div>
                </div>

                {/* Bottom action bar */}
                <div className="w-full relative z-20 bg-surface/90 backdrop-blur-overlay-md border border-b-0 border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] px-4 sm:px-8 py-3.5 flex justify-between items-center gap-3 max-w-3xl mx-auto rounded-t-2xl shadow-[shadow:var(--double-bezel-shadow)] mt-2">
                    <p id="getting-started-hint" className="text-xs text-on-surface-variant min-w-0">
                        {canContinue
                            ? "Podrás ajustar el resto cuando quieras desde Ajustes."
                            : "Selecciona una carpeta local o continúa con Google Drive."}
                    </p>
                    <Button
                        type="button"
                        intent="primary"
                        size="md"
                        onClick={() => void handleSave("local")}
                        disabled={!canContinue}
                        aria-describedby="getting-started-hint"
                        className="shrink-0 px-6"
                        loading={isPending}
                        rightIcon={<IconNavigationRocket className="w-4 h-4" />}
                    >
                        Abrir biblioteca
                    </Button>
                </div>
            </main>
        </m.div>
    )

    return (
        <AnimatePresence mode="wait" initial={false}>
            {isPending ? <LoadingOverlayWithLogo key="loader" /> : content}
        </AnimatePresence>
    )
}
