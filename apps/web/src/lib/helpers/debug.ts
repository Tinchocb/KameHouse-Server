/* eslint-disable no-console */
export const logger = (prefix: string, silence?: boolean) => {
    return {
        info: (...data: unknown[]) => {
            if (silence) return
            console.log(`%c[${prefix}]`, "color: #38bdf8; font-weight: bold;", ...data)
        },
        success: (...data: unknown[]) => {
            if (silence) return
            console.log(`%c[${prefix}]`, "color: #10b981; font-weight: bold;", ...data)
        },
        error: (...data: unknown[]) => {
            if (silence) return
            console.error(`%c[${prefix}]`, "color: #ef4444; font-weight: bold;", ...data)
        },
    }
}

const isDev = import.meta.env.MODE !== "production"

/**
 * Logger compartido sin prefijo. `debug` solo existe en dev (en prod es
 * no-op); warn/error siempre registran porque son diagnósticos útiles
 * en reportes de reproducción y red.
 */
export const log = {
    debug: (...data: unknown[]) => {
        if (isDev) console.log(...data)
    },
    info: (...data: unknown[]) => {
        console.info(...data)
    },
    warn: (...data: unknown[]) => {
        console.warn(...data)
    },
    error: (...data: unknown[]) => {
        console.error(...data)
    },
}



