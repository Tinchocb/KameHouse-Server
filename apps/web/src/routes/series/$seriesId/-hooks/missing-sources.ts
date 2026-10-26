import type { MediaSourceInfo } from "@/api/generated/types"

type MissingSourcesKind =
    | "local"
    | "local-off"
    | "cloud-off"
    | "cloud-unsynced"
    | "pref-local-empty"
    | "pref-cloud-empty"
    | "scope"

interface MissingSources {
    kind: MissingSourcesKind
    title: string
    message: string
}

/**
 * Explica por qué no hay nada para reproducir. Lee lo que manda el backend (`handlers/media_source.go`):
 * los interruptores "Usar el disco local" y "Usar Google Drive" (`localEnabled`, `cloudEnabled`) y la
 * preferencia por serie (`preference`: "auto" | "local" | "cloud"). Los conteos son de todos los archivos,
 * sin filtrar. La preferencia solo rige si su origen está encendido; si no, el backend usa Automático.
 * Orden: primero lo que la preferencia oculta (cambiarla desbloquea), después los interruptores apagados,
 * después el alcance y al final el caso sin archivos.
 * El selector de preferencia solo está en la página de Series: los mensajes de preferencia no aplican a películas.
 * `scope` es el recorte que se está mirando ("esta saga" / "esta serie" / "esta película").
 */
export function describeMissingSources(info: MediaSourceInfo | undefined, scope = "esta serie"): MissingSources {
    if (!info) return noLocalFiles(scope)
    const { localFiles: local, cloudFiles: cloud, localEnabled, cloudEnabled, preference } = info
    const isSeries = !scope.includes("película")
    const subject = isSeries ? "Esta serie" : "Esta película"
    const effPref = (preference === "local" && !localEnabled) || (preference === "cloud" && !cloudEnabled) ? "auto" : preference

    if (isSeries && effPref === "local" && local === 0 && cloud > 0) {
        return {
            kind: "pref-local-empty",
            title: "Origen fijado a Local",
            message: `${subject} está fijada a Local y no tiene archivos locales. Cámbiala a Automático o Nube.`,
        }
    }
    if (isSeries && effPref === "cloud" && cloud === 0 && local > 0 && localEnabled) {
        return {
            kind: "pref-cloud-empty",
            title: "Origen fijado a Nube",
            message: `${subject} está fijada a Nube y no tiene archivos en la nube. Cámbiala a Automático o Local.`,
        }
    }
    if (!localEnabled && local > 0) {
        return {
            kind: "local-off",
            title: "La fuente local está apagada",
            message: `Tus archivos locales están, pero "Usar el disco local" está apagado en Ajustes.`,
        }
    }
    if (!cloudEnabled && cloud > 0) {
        return {
            kind: "cloud-off",
            title: "La fuente en la nube está apagada",
            message: `Los archivos de ${scope} están en la nube, pero esa fuente está desactivada. Actívala en Ajustes para reproducirlos.`,
        }
    }
    if ((localEnabled && local > 0) || (cloudEnabled && cloud > 0)) {
        // Hay archivos que las fuentes activas dejan ver, pero ninguno corresponde al recorte actual.
        return {
            kind: "scope",
            title: "No hay episodios detectados",
            message: `Ninguno de tus archivos corresponde a ${scope}.`,
        }
    }
    if (cloudEnabled && effPref !== "local") {
        return {
            kind: "cloud-unsynced",
            title: "Nube sin sincronizar",
            message: `La fuente en la nube está activada, pero todavía no hay archivos sincronizados de ${scope}. Sincroniza Drive desde Ajustes.`,
        }
    }
    if (!localEnabled) {
        // Con el disco apagado, escanear está bloqueado: no se recomienda.
        return {
            kind: "local-off",
            title: "La fuente local está apagada",
            message: `No hay archivos locales de ${scope} porque "Usar el disco local" está apagado en Ajustes.`,
        }
    }
    return noLocalFiles(scope)
}

function noLocalFiles(scope: string): MissingSources {
    return {
        kind: "local",
        title: "No hay episodios detectados",
        message: `No encontramos archivos locales de ${scope}. Agrégalos a tu biblioteca y vuelve a escanear para verlos aquí.`,
    }
}
