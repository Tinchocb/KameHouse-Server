import { create } from "zustand"
import { persist, subscribeWithSelector, devtools } from "zustand/middleware"
import { detectHardwareSpecs, type HardwareSpecs, type HardwareTier } from "./hardware-profiler"

export type PerformanceProfile = "auto" | "ultra" | "balanced" | "eco"

interface PerformanceState {
    performanceProfile: PerformanceProfile
    autoGovernorEnabled: boolean
    autoThrottleActive: boolean
    hardwareSpecs: HardwareSpecs | null
    isDetecting: boolean

    detectHardware: (forceRefresh?: boolean) => Promise<HardwareSpecs>
    setPerformanceProfile: (profile: PerformanceProfile) => void
    setAutoGovernorEnabled: (enabled: boolean) => void
    setAutoThrottleActive: (active: boolean) => void
    getEffectiveTier: () => HardwareTier
}

export const selectEffectiveTier = (state: PerformanceState): HardwareTier => {
    if (state.autoThrottleActive) return "low_power"
    if (state.performanceProfile === "ultra") return "high"
    if (state.performanceProfile === "balanced") return "balanced"
    if (state.performanceProfile === "eco") return "low_power"
    return state.hardwareSpecs?.detectedTier || "balanced"
}

export const selectIsHeavyEffectsAllowed = (state: PerformanceState): boolean => {
    const tier = selectEffectiveTier(state)
    return tier === "high" || tier === "balanced"
}

export const usePerformanceStore = create<PerformanceState>()(
    subscribeWithSelector(
        persist(
            devtools(
                (set, get) => ({
                    performanceProfile: "auto" as PerformanceProfile,
                    autoGovernorEnabled: true,
                    autoThrottleActive: false,
                    hardwareSpecs: null as HardwareSpecs | null,
                    isDetecting: false,

                    detectHardware: async (forceRefresh = false) => {
                        const currentSpecs = get().hardwareSpecs
                        if (currentSpecs && !forceRefresh) {
                            return currentSpecs
                        }
                        set({ isDetecting: true })
                        try {
                            const specs = await detectHardwareSpecs(forceRefresh)
                            set({ hardwareSpecs: specs, isDetecting: false })
                            return specs
                        } catch (err) {
                            set({ isDetecting: false })
                            throw err
                        }
                    },

                    setPerformanceProfile: (performanceProfile: PerformanceProfile) => {
                        set({ performanceProfile })
                    },

                    setAutoGovernorEnabled: (autoGovernorEnabled: boolean) => {
                        set({ autoGovernorEnabled })
                        if (!autoGovernorEnabled) {
                            set({ autoThrottleActive: false })
                        }
                    },

                    setAutoThrottleActive: (autoThrottleActive: boolean) => {
                        set({ autoThrottleActive })
                    },

                    getEffectiveTier: (): HardwareTier => {
                        return selectEffectiveTier(get())
                    },
                })
            ),
            {
                name: "kamehouse-performance-settings",
                version: 1,
                migrate: (persisted, version) => {
                    const p = (persisted ?? {}) as Partial<PerformanceState>
                    if (version < 1) {
                        // v0 persistía hardwareSpecs pesado/obsoleto: descartar y re-detectar
                        return { ...p, hardwareSpecs: null } as PerformanceState
                    }
                    return p as PerformanceState
                },
                partialize: (state) => ({
                    hardwareSpecs: state.hardwareSpecs,
                    performanceProfile: state.performanceProfile,
                    autoGovernorEnabled: state.autoGovernorEnabled,
                }),
            }
        )
    )
)

// Auto-run detection and display calibration on initial client boot
if (typeof window !== "undefined") {
    const runIdleDetection = () => {
        const store = usePerformanceStore.getState()
        if (!store.hardwareSpecs) {
            store.detectHardware(false).catch(() => {})
        }
    }

    if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(runIdleDetection, { timeout: 3000 })
    } else {
        setTimeout(runIdleDetection, 1500)
    }

    // Auto-throttle cuando la pestaña pasa a segundo plano para ahorrar batería/GPU
    document.addEventListener("visibilitychange", () => {
        const store = usePerformanceStore.getState()
        if (store.autoGovernorEnabled) {
            store.setAutoThrottleActive(document.hidden)
        }
    })
}
