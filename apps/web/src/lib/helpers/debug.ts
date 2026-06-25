'use no memo'
import chalk from "chalk"

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


