export const logger = (prefix: string, silence?: boolean) => {
    return {
        info: (...data: unknown[]) => {
            if (silence) return
            console.log(`%c[${prefix}]`, "color: #38bdf8; font-weight: bold;", ...data)
        },
        warning: (...data: unknown[]) => {
            if (silence) return
            console.warn(`%c[${prefix}]`, "color: #f59e0b; font-weight: bold;", ...data)
        },
        warn: (...data: unknown[]) => {
            if (silence) return
            console.warn(`%c[${prefix}]`, "color: #f59e0b; font-weight: bold;", ...data)
        },
        success: (...data: unknown[]) => {
            if (silence) return
            console.log(`%c[${prefix}]`, "color: #10b981; font-weight: bold;", ...data)
        },
        error: (...data: unknown[]) => {
            if (silence) return
            console.error(`%c[${prefix}]`, "color: #ef4444; font-weight: bold;", ...data)
        },
        trace: (...data: unknown[]) => {
            if (silence || import.meta.env.MODE !== "development") return
            console.debug(`%c[${prefix}]`, "color: #a1a1aa; font-weight: bold;", ...data)
        },
    }
}


