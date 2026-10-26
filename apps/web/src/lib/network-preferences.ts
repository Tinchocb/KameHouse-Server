/** Preferencia del navegador para evitar descargas especulativas. */
export function isDataSavingEnabled(): boolean {
    if (typeof navigator === "undefined") return false
    return Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
}
