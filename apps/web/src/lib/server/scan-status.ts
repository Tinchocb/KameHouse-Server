/**
 * Traduce los SCAN_STATUS del escáner local (el servidor los emite en inglés,
 * ver internal/library/scanner/scanner_engine.go). Desconocidos pasan tal cual.
 */
const STATUS_ES: [RegExp, string][] = [
    [/^retrieving local files/i, "Buscando archivos en disco…"],
    [/^loading existing library/i, "Cargando la biblioteca existente…"],
    [/^verifying shelved/i, "Revisando archivos apartados…"],
    [/^scanning local files/i, "Analizando archivos…"],
    [/^fetching additional matching/i, "Obteniendo datos para identificar…"],
    [/^fetching media/i, "Obteniendo datos para identificar…"],
    [/^matching local files/i, "Identificando series y episodios…"],
    [/^hydrating metadata/i, "Completando metadatos…"],
    [/^adding missing media/i, "Agregando series faltantes…"],
    [/^verifying file integrity/i, "Verificando integridad…"],
    [/^scan completed/i, "Escaneo completado"],
]

export function translateScanStatus(status: string): string {
    const match = STATUS_ES.find(([re]) => re.test(status.trim()))
    return match ? match[1] : status
}

export function isScanCompletedStatus(status: string): boolean {
    const lower = status.toLowerCase()
    return lower.includes("completed") || lower.includes("finished")
}
