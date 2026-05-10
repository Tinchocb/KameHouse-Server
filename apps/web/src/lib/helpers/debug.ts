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

    React.useEffect(() => {
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

        if (Object.keys(changedDeps).length) {
            console.log("[useEffectDebugger] Changed dependencies:", changedDeps)
        }

        previousDeps.current = dependencies

        return effectHook()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies) // Pass the original dependencies to useEffect
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
