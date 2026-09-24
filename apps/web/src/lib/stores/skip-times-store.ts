import { create } from "zustand"
import { persist } from "zustand/middleware"
import { subscribeWithSelector } from "zustand/middleware"
import { devtools } from "zustand/middleware"
import { useShallow } from "zustand/react/shallow"

export interface SkipTimesState {
    seriesSkipTimes: Record<string, { opStart?: number; opEnd?: number; edOffset?: number; edEnd?: number }>
    saveSeriesSkipTimes: (key: string | number, opStart: number, opEnd: number, edOffset: number, edEnd?: number) => void
}

export const useSkipTimesStore = create<SkipTimesState>()(
    devtools(
        subscribeWithSelector(
            persist(
                (set) => ({
                    seriesSkipTimes: {},
                    saveSeriesSkipTimes: (key, opStart, opEnd, edOffset, edEnd) =>
                        set(state => ({
                            seriesSkipTimes: {
                                ...state.seriesSkipTimes,
                                [String(key)]: { opStart, opEnd, edOffset, edEnd }
                            }
                        })),
                }),
                {
                    name: "kamehouse-skip-times",
                    version: 2,
                    migrate: (persistedState: unknown, version: number) => {
                        if (version < 2) {
                            return { seriesSkipTimes: {} } as SkipTimesState
                        }
                        return persistedState as SkipTimesState
                    },
                }
            )
        )
    )
)

// Shallow selector for skip times
export const useSkipTimesMap = () => useSkipTimesStore(useShallow((state) => ({
    seriesSkipTimes: state.seriesSkipTimes,
    saveSeriesSkipTimes: state.saveSeriesSkipTimes,
})))