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
