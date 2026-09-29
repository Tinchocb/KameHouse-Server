/**
 * Traduce los errores crudos del servidor (en inglés, tal como los devuelven los handlers de Go)
 * a un texto en español apto para un toast. Lo que no reconoce se muestra con un prefijo en
 * español para que al menos el marco del mensaje esté en el idioma de la app.
 */

const RULES: Array<[RegExp, string]> = [
    [/too many requests/i, "La plataforma recibió demasiadas solicitudes. Espera un momento y vuelve a intentar."],
    [/library not available/i, "La biblioteca aún no está disponible. Reintenta en unos segundos."],
    [/google drive integration is not (active|enabled)/i, "Google Drive no está activo. Actívalo en Ajustes."],
    [/access denied|forbidden|not allowed/i, "No se puede acceder a ese archivo o carpeta desde KameHouse."],
    [/not found/i, "No se encontró ese contenido en tu biblioteca. Puede haberse movido o eliminado."],
    [/\b(invalid|required|must be|expected)\b/i, "La solicitud no es válida. Recarga la página e intenta de nuevo."],
]

/** El servidor responde "feature disabled" cuando una función está apagada en la configuración. */
export function isFeatureDisabledError(raw: string): boolean {
    return /feature disabled/i.test(raw)
}

function matchRule(raw: string): string | undefined {
    for (const [pattern, message] of RULES) {
        if (pattern.test(raw)) return message
    }
    return undefined
}

/** Texto en español para un mensaje de error del servidor; `raw` no vacío. */
export function translateServerError(raw: string): string {
    return matchRule(raw) ?? "Error del servidor: " + raw
}

/**
 * Texto de un toast a partir de un error capturado (`catch` / `onError`). Traduce lo que
 * reconoce; si el mensaje no es de un patrón conocido lo deja tal cual (puede ser un aviso
 * ya en español del servidor) y, sin mensaje, usa `fallback`.
 */
export function errorText(err: unknown, fallback: string): string {
    if (!(err instanceof Error) || !err.message) return fallback
    if (/failed to fetch|networkerror|load failed/i.test(err.message)) {
        return "No se pudo conectar con el servidor de KameHouse."
    }
    if (/^HTTP Error \d+$/.test(err.message)) return fallback
    return matchRule(err.message) ?? err.message
}
