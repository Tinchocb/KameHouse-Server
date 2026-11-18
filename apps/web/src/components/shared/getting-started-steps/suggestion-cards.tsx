import { useGetFFmpegStatus, useInstallFFmpeg } from "@/api/hooks/mediastream.hooks"
import { Button } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { IconMediaPlay, IconStatusZap, IconUiSettings, IconUiSpinner } from "@/components/ui/icons"
import { useNavigate } from "@tanstack/react-router"
import React from "react"

type SuggestionProps = {
    icon: React.ReactNode
    title: string
    description: string
    actionLabel: string
    onAction: () => void
    disabled?: boolean
}

function SuggestionCard({ icon, title, description, actionLabel, onAction, disabled }: SuggestionProps) {
    return (
        <li className="flex flex-col gap-3 rounded-2xl border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] bg-surface-container-low/90 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-container [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/15 p-4 text-left transition-[background-color,border-color] duration-base shadow-[shadow:var(--double-bezel-shadow)]">
            <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-brand-accent/15 text-brand-accent-readable flex items-center justify-center shrink-0" aria-hidden>
                    {icon}
                </span>
                <h4 className="text-sm font-semibold text-on-surface">{title}</h4>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed flex-1">{description}</p>
            <Button intent="outline" size="sm" onClick={onAction} disabled={disabled} className="self-start mt-0.5">
                {actionLabel}
            </Button>
        </li>
    )
}

// Ajustes opcionales que antes bloqueaban el onboarding. Ya tienen un valor por
// defecto razonable: aquí sólo se ofrece cambiarlos, sin obligar a nada.
export function SuggestionCards() {
    const navigate = useNavigate()
    const { data: ffmpeg } = useGetFFmpegStatus()
    const { mutate: installFFmpeg, isPending: isInstalling } = useInstallFFmpeg()

    const engineReady = !!ffmpeg?.ffmpegAvailable && !!ffmpeg?.ffprobeAvailable
    const downloading = !!ffmpeg?.isDownloading || isInstalling
    const showFfmpegCard = !!ffmpeg && !engineReady
    const goToSettings = (tab: "playback" | "library") => () => navigate({ to: "/settings", search: { tab } })

    return (
        <section aria-labelledby="suggestions-title" className="w-full max-w-3xl mx-auto mt-6">
            <h3 id="suggestions-title" className="text-xs font-semibold text-on-surface-variant mb-3 text-center tracking-wide uppercase">
                Sugerencias opcionales
            </h3>
            <ul className={cn(
                "grid grid-cols-1 gap-3",
                showFfmpegCard ? "sm:grid-cols-3" : "sm:grid-cols-2"
            )}>
                {/* Sin datos de FFmpeg (cargando) no se muestra nada: evita un parpadeo falso. */}
                {showFfmpegCard && (
                    <SuggestionCard
                        icon={downloading ? <IconUiSpinner className="w-4 h-4 animate-spin" /> : <IconStatusZap className="w-4 h-4" />}
                        title="Motor de vídeo"
                        description={downloading
                            ? `Instalando FFmpeg (${ffmpeg?.downloadProgress ?? 0}%)…`
                            : "Instala FFmpeg para leer pistas de audio y generar miniaturas."}
                        actionLabel={downloading ? "Instalando…" : "Instalar con un clic"}
                        onAction={() => installFFmpeg()}
                        disabled={downloading}
                    />
                )}
                <SuggestionCard
                    icon={<IconMediaPlay className="w-4 h-4" />}
                    title="Reproducción"
                    description="El siguiente episodio empieza solo y KameHouse recuerda dónde lo dejaste."
                    actionLabel="Ajustar reproducción"
                    onAction={goToSettings("playback")}
                />
                <SuggestionCard
                    icon={<IconUiSettings className="w-4 h-4" />}
                    title="Idioma"
                    description="Títulos y sinopsis en español latino. Puedes elegir otro idioma."
                    actionLabel="Cambiar idioma"
                    onAction={goToSettings("library")}
                />
            </ul>
        </section>
    )
}
