'use no memo'
import chalk from "chalk"
import React from "react"

export const logger = (prefix: string, silence?: boolean) => {

    return {
        info: (...data: unknown[]) => {
            if (silence) return
            console.log(chalk.blue(`[${prefix}]`) + " ", ...data)
        },
        warning: (...data: unknown[]) => {
            if (silence) return
            console.log(chalk.yellow(`[${prefix}]`) + " ", ...data)
        },
        warn: (...data: unknown[]) => {
            if (silence) return
            console.log(chalk.yellow(`[${prefix}]`) + " ", ...data)
        },
        success: (...data: unknown[]) => {
            if (silence) return
            console.log(chalk.green(`[${prefix}]`) + " ", ...data)
        },
        error: (...data: unknown[]) => {
            if (silence) return
            console.log(chalk.red(`[${prefix}]`) + " ", ...data)
        },
        trace: (...data: unknown[]) => {
            if (silence || import.meta.env.MODE !== "development") return
            console.log(chalk.bgGray(`[${prefix}]`) + " ", ...data)
        },
    }

}

export const useEffectDebugger = (
    effectHook: () => void | (() => void),
    dependencies: unknown[],
    dependencyNames: string[] = [],
) => {
    const previousDeps = React.useRef(dependencies)
    const effectRef = React.useRef(effectHook)
    const cleanupRef = React.useRef<void | (() => void)>(undefined)
    const isFirstRun = React.useRef(true)

    React.useEffect(() => {
        effectRef.current = effectHook
    })

    React.useEffect(() => {
        const isFirst = isFirstRun.current
        if (isFirst) {
            isFirstRun.current = false
        }

        const changedDeps = dependencies.reduce((accum: Record<string, unknown>, dependency, index) => {
            if (dependency !== previousDeps.current[index]) {
                const keyName = dependencyNames[index] || `Dependency #${index}`
                return {
                    ...accum,
                    [keyName]: {
                        before: previousDeps.current[index],
                        after: dependency,
                    },
                }
            }
            return accum
        }, {} as Record<string, unknown>)

        const hasChanged = isFirst || Object.keys(changedDeps).length > 0 || previousDeps.current.length !== dependencies.length

        if (hasChanged) {
            if (!isFirst && Object.keys(changedDeps).length) {
                console.log("[useEffectDebugger] Changed dependencies:", changedDeps)
            }
            previousDeps.current = dependencies
            if (cleanupRef.current) {
                cleanupRef.current()
            }
            cleanupRef.current = effectRef.current()
        }
    })

    React.useEffect(() => {
        return () => {
            if (cleanupRef.current) {
                cleanupRef.current()
            }
        }
    }, [])
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useLatestFunction<T extends (...args: any[]) => any>(callback: T): T {
    const callbackRef = React.useRef(callback)

    React.useLayoutEffect(() => {
        callbackRef.current = callback
    }, [callback])

    const cb = React.useCallback((...args: Parameters<T>): ReturnType<T> => {
        return callbackRef.current(...args)
    }, [])

    return cb as unknown as T
}
