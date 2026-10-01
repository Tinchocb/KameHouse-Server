import { Status } from "@/api/generated/types"
import { useGettingStarted } from "@/api/hooks/settings.hooks"
import { LoadingOverlayWithLogo } from "@/components/shared/loading-overlay-with-logo"
import { Button } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { Form } from "@/components/ui/form"
import { getDefaultSettings, gettingStartedSchema } from "@/lib/server/settings"
import type { UseFormReturn } from "react-hook-form"
import type { z } from "zod"
import { AnimatePresence, m } from "framer-motion"
import React from "react"
import { IconNavigationHome, IconNavigationChevronLeft, IconNavigationRocket, IconNavigationChevronRight } from "@/components/ui/icons"
import { toast } from "sonner"
import { useNavigate } from "@tanstack/react-router"
import { usePlayerStore } from "@/lib/store"
import { stepVariants } from "@/components/shared/getting-started-steps/variants"
import { STEPS, StepIndicator } from "@/components/shared/getting-started-steps/step-chrome"
import { LibraryStep } from "@/components/shared/getting-started-steps/library-step"
import { MediaEngineStep } from "@/components/shared/getting-started-steps/media-engine-step"
import { PlaybackStep } from "@/components/shared/getting-started-steps/playback-step"
import { LanguageStep } from "@/components/shared/getting-started-steps/language-step"

/* ---------------- MAIN COMPONENT: GETTING STARTED ---------------- */
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
    const { mutate: mutateStart, isPending: isPendingStart } = useGettingStarted()
    const navigate = useNavigate()

    const [currentStep, setCurrentStep] = React.useState(0)
    const [direction, setDirection] = React.useState(0)

    const formRef = React.useRef<UseFormReturn<z.infer<typeof gettingStartedSchema>> | null>(null)
    const currentSettings = status?.settings

    // El player lee marathon/tvMode del store local, no del servidor:
    // sincronizar al guardar para no quedar divergente hasta pasar por Ajustes.
    const syncLocalPlaybackModes = (lib: { marathonMode?: boolean; tvMode?: boolean } | undefined) => {
        try {
            const st = usePlayerStore.getState()
            st.setMarathonMode?.(lib?.marathonMode ?? currentSettings?.library?.marathonMode ?? false)
            st.setTvMode?.(lib?.tvMode ?? currentSettings?.library?.tvMode ?? false)
        } catch {}
    }

    // States for the 3 Essential Steps pre-filled from existing server settings
    const [playbackFeatures, setPlaybackFeatures] = React.useState({
        autoDetectSkipTimes: currentSettings?.library?.autoDetectSkipTimes ?? true,
        autoPlayNextEpisode: currentSettings?.library?.autoPlayNextEpisode ?? true,
        enableWatchContinuity: currentSettings?.library?.enableWatchContinuity ?? true,
        autoScan: currentSettings?.library?.autoScan ?? false,
    })

    const [selectedLanguage, setSelectedLanguage] = React.useState(
        currentSettings?.library?.tmdbLanguage || "es-MX"
    )
    const [flexibleMatching, setFlexibleMatching] = React.useState(
        !currentSettings?.library?.scannerStrictStructure
    )

    const handleGoToHome = () => {
        if (onClose) {
            onClose()
        }
        navigate({ to: "/home" })
        if (window.location.pathname !== "/home") {
            window.location.href = "/home"
        }
    }

    const nextStep = () => {
        if (currentStep < STEPS.length - 1) {
            setDirection(1)
            setCurrentStep(currentStep + 1)
        }
    }

    const prevStep = () => {
        if (currentStep > 0) {
            setDirection(-1)
            setCurrentStep(currentStep - 1)
        }
    }

    const goToStep = (step: number) => {
        if (step >= 0 && step < STEPS.length) {
            setDirection(step > currentStep ? 1 : -1)
            setCurrentStep(step)
        }
    }

    const isPending = isPendingStart
    if (isPending) return <LoadingOverlayWithLogo />

    const initialSeriesPaths = currentSettings?.library?.seriesPaths && currentSettings.library.seriesPaths.length > 0
        ? currentSettings.library.seriesPaths
        : []

    const initialMoviePaths = currentSettings?.library?.moviePaths && currentSettings.library.moviePaths.length > 0
        ? currentSettings.library.moviePaths
        : []

    return (
        <div className={cn(
            "w-full bg-bg-primary relative flex flex-col justify-between select-none overflow-hidden",
            embedded ? "rounded-2xl border border-border-subtle p-4 sm:p-6" : isModal ? "p-4 sm:p-6" : "min-h-[100dvh] h-[100dvh]"
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
                <div className="w-full relative z-10 px-4 sm:px-8 pt-4 sm:pt-6 flex justify-between items-center border-b border-border-subtle pb-3">
                    <div className="flex items-center gap-2">
                        <span className="font-display tracking-widest text-lg sm:text-xl font-bold text-on-surface uppercase">
                            KAMEHOUSE
                        </span>
                        <span className="text-3xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent border border-brand-accent/30">
                            Configuración
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            intent="gray-outline"
                            onClick={handleGoToHome}
                            leftIcon={<IconNavigationHome className="w-3.5 h-3.5" />}
                            className="rounded-xl text-xs"
                        >
                            Ir al Inicio
                        </Button>
                    </div>
                </div>
            )}

            {/* Middle scrollable content */}
            <div className="w-full flex-1 overflow-y-auto relative z-10 px-4 sm:px-8 py-3 sm:py-5 flex flex-col justify-center items-center">
                <div className="w-full max-w-2xl">
                    <Form
                        schema={gettingStartedSchema}
                        onSubmit={data => {
                            if (currentStep === STEPS.length - 1) {
                                const payload = getDefaultSettings(data, currentSettings)
                                if (payload.library) {
                                    payload.library.autoDetectSkipTimes = playbackFeatures.autoDetectSkipTimes
                                    payload.library.autoPlayNextEpisode = playbackFeatures.autoPlayNextEpisode
                                    payload.library.enableWatchContinuity = playbackFeatures.enableWatchContinuity
                                    payload.library.autoScan = playbackFeatures.autoScan
                                    payload.library.tmdbLanguage = selectedLanguage
                                    payload.library.scannerStrictStructure = !flexibleMatching
                                }

                                mutateStart(payload, {
                                    onSuccess: () => {
                                        syncLocalPlaybackModes(data.library)
                                        toast.success("Configuración de KameHouse guardada con éxito")
                                        handleGoToHome()
                                    },
                                    onError: () => {
                                        toast.error("Error al guardar la configuración")
                                    }
                                })
                            } else {
                                nextStep()
                            }
                        }}
                        defaultValues={{
                            mediaPlayer: currentSettings?.mediaPlayer || {},
                            library: {
                                enableRichPresence: false,
                                enableWatchContinuity: playbackFeatures.enableWatchContinuity,
                                seriesPaths: initialSeriesPaths,
                                moviePaths: initialMoviePaths,
                                disableLocalScanning: currentSettings?.library?.disableLocalScanning ?? false,
                                disableCloudSource: currentSettings?.library?.disableCloudSource ?? false,
                                tmdbApiKey: currentSettings?.library?.tmdbApiKey || "",
                                scannerProvider: currentSettings?.library?.scannerProvider || "tmdb",
                                primaryMetadataProvider: currentSettings?.library?.primaryMetadataProvider || "tmdb",
                                tmdbLanguage: selectedLanguage,
                            },
                            enableTranscode: currentSettings?.mediastream?.transcodeEnabled ?? false,
                            notifications: {
                                disableNotifications: currentSettings?.notifications?.disableNotifications ?? false,
                                disableAutoScannerNotifications: currentSettings?.notifications?.disableAutoScannerNotifications ?? false,
                            }
                        }}
                    >
                        {(formMethods) => {
                            formRef.current = formMethods
                            return (
                                <div className="space-y-4">
                                    <StepIndicator currentStep={currentStep} onStepClick={goToStep} />

                                    <AnimatePresence mode="wait" custom={direction}>
                                        <m.div
                                            key={currentStep}
                                            custom={direction}
                                            variants={stepVariants}
                                            initial="enter"
                                            animate="center"
                                            exit="exit"
                                            className="min-h-[300px]"
                                        >
                                            {currentStep === 0 && (
                                                <LibraryStep />
                                            )}
                                            {currentStep === 1 && (
                                                <MediaEngineStep />
                                            )}
                                            {currentStep === 2 && (
                                                <PlaybackStep
                                                    features={playbackFeatures}
                                                    setFeatures={setPlaybackFeatures}
                                                />
                                            )}
                                            {currentStep === 3 && (
                                                <LanguageStep
                                                    selectedLanguage={selectedLanguage}
                                                    setSelectedLanguage={setSelectedLanguage}
                                                    flexibleMatching={flexibleMatching}
                                                    setFlexibleMatching={setFlexibleMatching}
                                                />
                                            )}
                                        </m.div>
                                    </AnimatePresence>
                                </div>
                            )
                        }}
                    </Form>
                </div>
            </div>

            {/* Bottom sticky action bar */}
            <div className="w-full relative z-20 bg-surface/90 backdrop-blur-overlay-xl border-t border-border-subtle px-4 sm:px-8 py-3.5 flex justify-between items-center max-w-3xl mx-auto rounded-t-2xl shadow-modal mt-2">
                <div className="flex items-center gap-2">
                    {currentStep > 0 && (
                        <Button
                            type="button"
                            intent="gray-outline"
                            size="sm"
                            onClick={e => {
                                e.preventDefault()
                                prevStep()
                            }}
                            className="rounded-xl text-xs sm:text-sm px-4 h-10 border-border-subtle [@media(hover:hover)_and_(pointer:fine)]:hover:border-border-strong [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-container active:scale-95 transition-[background-color,border-color,transform] duration-fast ease-smooth-out cursor-pointer"
                            leftIcon={<IconNavigationChevronLeft className="w-4 h-4" />}
                        >
                            Anterior
                        </Button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {currentStep === STEPS.length - 1 ? (
                        <Button
                            type="button"
                            intent="primary"
                            size="sm"
                            onClick={() => {
                                if (formRef.current) {
                                    formRef.current.handleSubmit((data) => {
                                        const payload = getDefaultSettings(data, currentSettings)
                                        if (payload.library) {
                                            payload.library.autoDetectSkipTimes = playbackFeatures.autoDetectSkipTimes
                                            payload.library.autoPlayNextEpisode = playbackFeatures.autoPlayNextEpisode
                                            payload.library.enableWatchContinuity = playbackFeatures.enableWatchContinuity
                                            payload.library.autoScan = playbackFeatures.autoScan
                                            payload.library.tmdbLanguage = selectedLanguage
                                            payload.library.scannerStrictStructure = !flexibleMatching
                                        }
                                        mutateStart(payload, {
                                            onSuccess: () => {
                                                syncLocalPlaybackModes(data.library)
                                                toast.success("Configuración actualizada con éxito")
                                                handleGoToHome()
                                            },
                                            onError: () => {
                                                toast.error("Error al guardar la configuración")
                                            }
                                        })
                                    })()
                                }
                            }}
                            className="rounded-full font-bold uppercase tracking-wider px-6 h-10 text-xs sm:text-sm shadow-elevation-2 bg-brand-accent [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-110 active:scale-95 text-on-primary cursor-pointer border-none transition-[filter,transform] duration-fast ease-smooth-out"
                            loading={isPending}
                            rightIcon={<IconNavigationRocket className="w-4 h-4" />}
                        >
                            Guardar y Comenzar
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            intent="primary"
                            size="sm"
                            onClick={e => {
                                e.preventDefault()
                                nextStep()
                            }}
                            className="rounded-xl font-bold uppercase tracking-wider px-5 h-10 text-xs sm:text-sm bg-brand-accent text-on-primary [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-110 active:scale-95 shadow-md shadow-brand-accent/25 cursor-pointer transition-[filter,transform] duration-fast ease-smooth-out"
                            rightIcon={<IconNavigationChevronRight className="w-4 h-4" />}
                        >
                            Siguiente
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
