import { useGetFFmpegStatus, useInstallFFmpeg } from "@/api/hooks/mediastream.hooks"
import { cn } from "@/components/ui/core/styling"
import { m } from "framer-motion"
import { IconUiSpinner, IconUiCheckCircle, IconUiAlert, IconUiDownload } from "@/components/ui/icons"
import { containerVariants, itemVariants } from "./variants"
import { StepCard } from "./step-chrome"

/* ---------------- STEP 2: REQUISITOS (FFMPEG) ---------------- */
export function MediaEngineStep() {
    const { data: status, isLoading } = useGetFFmpegStatus()
    const { mutate: installFFmpeg, isPending: isInstalling } = useInstallFFmpeg()

    const isDownloading = status?.isDownloading || isInstalling
    const isBothAvailable = !!status?.ffmpegAvailable && !!status?.ffprobeAvailable

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
                    2. Motor de Video (FFmpeg)
                </h2>
                <p className="text-on-surface-variant text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                    KameHouse utiliza FFmpeg y FFprobe para leer códecs, pistas de audio, subtítulos integrados y generar miniaturas.
                </p>
            </m.div>

            <StepCard>
                <m.div variants={itemVariants} className="space-y-4">
                    {/* Status Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-container-low border border-border-subtle">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                                isBothAvailable
                                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                    : isDownloading
                                        ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                                        : "bg-rose-500/15 border-rose-500/30 text-rose-400"
                            )}>
                                {isDownloading ? (
                                    <IconUiSpinner className="w-5 h-5 animate-spin" />
                                ) : isBothAvailable ? (
                                    <IconUiCheckCircle className="w-5 h-5" />
                                ) : (
                                    <IconUiAlert className="w-5 h-5" />
                                )}
                            </div>

                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-xs sm:text-sm text-on-surface">
                                        Estado de FFmpeg / FFprobe
                                    </h4>
                                    {isLoading ? (
                                        <span className="text-3xs px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">Verificando...</span>
                                    ) : isBothAvailable ? (
                                        <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                            Listo
                                        </span>
                                    ) : isDownloading ? (
                                        <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                            Instalando ({status?.downloadProgress ?? 0}%)
                                        </span>
                                    ) : (
                                        <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                            No instalado
                                        </span>
                                    )}
                                </div>
                                <p className="text-2xs text-on-surface-variant truncate">
                                    {isBothAvailable
                                        ? "Los binarios necesarios están correctamente instalados y listos."
                                        : isDownloading
                                            ? (status?.downloadStatus || "Descargando binarios portables...")
                                            : "Puedes instalarlos automáticamente con 1 clic sin salir del asistente."}
                                </p>
                            </div>
                        </div>

                        {!isBothAvailable && (
                            <m.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.95 }}
                                type="button"
                                onClick={() => installFFmpeg()}
                                disabled={isDownloading}
                                className={cn(
                                    "px-4 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-[filter,transform,opacity] duration-fast ease-smooth-out shrink-0 cursor-pointer",
                                    "bg-brand-accent text-on-primary [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-110 shadow-md shadow-brand-accent/20",
                                    isDownloading && "opacity-60 cursor-not-allowed pointer-events-none"
                                )}
                            >
                                {isDownloading ? (
                                    <>
                                        <IconUiSpinner className="w-3.5 h-3.5 animate-spin" />
                                        <span>Descargando...</span>
                                    </>
                                ) : (
                                    <>
                                        <IconUiDownload className="w-3.5 h-3.5" />
                                        <span>Instalar Automáticamente</span>
                                    </>
                                )}
                            </m.button>
                        )}
                    </div>

                    {/* Progress bar if downloading */}
                    {isDownloading && (
                        <div className="space-y-1.5 p-3 rounded-xl bg-surface-container-low border border-border-subtle">
                            <div className="flex justify-between text-xs text-on-surface-variant font-medium">
                                <span>{status?.downloadStatus || "Descargando paquetes..."}</span>
                                <span>{status?.downloadProgress ?? 0}%</span>
                            </div>
                            <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-brand-accent transition-[width] duration-base rounded-full"
                                    style={{ width: `${Math.max(5, status?.downloadProgress ?? 0)}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Binaries grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div className="p-3 rounded-xl bg-surface-container-low border border-border-subtle flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-on-surface">ffprobe</span>
                                <span className={status?.ffprobeAvailable ? "text-emerald-400 font-medium text-2xs" : "text-rose-400 text-2xs"}>
                                    {status?.ffprobeAvailable ? "Detectado" : "Faltante"}
                                </span>
                            </div>
                            <span className="font-mono text-3xs text-on-surface-variant truncate" title={status?.ffprobePath}>
                                {status?.ffprobePath || "No configurado"}
                            </span>
                            {status?.ffprobeVersion && (
                                <span className="text-3xs text-on-surface-variant/70 truncate" title={status?.ffprobeVersion}>
                                    {status?.ffprobeVersion}
                                </span>
                            )}
                        </div>

                        <div className="p-3 rounded-xl bg-surface-container-low border border-border-subtle flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-on-surface">ffmpeg</span>
                                <span className={status?.ffmpegAvailable ? "text-emerald-400 font-medium text-2xs" : "text-rose-400 text-2xs"}>
                                    {status?.ffmpegAvailable ? "Detectado" : "Faltante"}
                                </span>
                            </div>
                            <span className="font-mono text-3xs text-on-surface-variant truncate" title={status?.ffmpegPath}>
                                {status?.ffmpegPath || "No configurado"}
                            </span>
                            {status?.ffmpegVersion && (
                                <span className="text-3xs text-on-surface-variant/70 truncate" title={status?.ffmpegVersion}>
                                    {status?.ffmpegVersion}
                                </span>
                            )}
                        </div>
                    </div>
                </m.div>
            </StepCard>
        </m.div>
    )
}
