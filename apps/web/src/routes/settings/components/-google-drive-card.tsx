import { errorText } from "@/api/client/error-messages"
import { useState, useEffect, useRef } from "react"
import { useFormContext } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { SectionBar } from "@/components/ui/sectionbar"
import { Button } from "@/components/ui/button"
import { InputAnatomy } from "@/components/ui/input/input-parts"
import { cn } from "@/components/ui/core/styling"
import { Cloud, ExternalLink, CheckCircle2, AlertCircle, Unlink, Copy, Upload, FolderSearch, RefreshCw } from "lucide-react"
import { IconUiSpinner } from "@/components/ui/icons"
import { toast } from "sonner"
import { buildApiQuery } from "@/api/client/requests"
import { getServerBaseUrl } from "@/api/client/server-url"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import {
    formatRelativeEs,
    useDriveStatus,
    useSelectDriveFolder,
    useTriggerDriveScan,
    useUpdateDriveSync,
    type DriveStatusResponse,
} from "@/lib/drive-status"
import { OsSelect, OsToggle } from "../components"
import type { SettingsFormValues } from "../index"
import { GoogleDriveFolderBrowser } from "./-google-drive-folder-browser"

function extractFolderId(input: string): string {
    const trimmed = input.trim()
    const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    if (match && match[1]) {
        return match[1]
    }
    return trimmed
}

function parseGoogleOAuthJson(raw: string): { clientId?: string; clientSecret?: string } | null {
    const trimmed = raw.trim()
    if (!trimmed.startsWith("{")) return null
    try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>
        const root = (parsed.web ?? parsed.installed ?? parsed) as Record<string, unknown>
        const clientId = typeof root.client_id === "string" ? root.client_id.trim() : undefined
        const clientSecret = typeof root.client_secret === "string" ? root.client_secret.trim() : undefined
        if (clientId || clientSecret) {
            return { clientId, clientSecret }
        }
    } catch {
        // No es JSON válido
    }
    return null
}

/** Frecuencias que ofrece el escaneo automático, en minutos (el servidor acota a 15 min – 24 h). */
const SYNC_INTERVAL_OPTIONS = [15, 30, 60, 180, 360, 720, 1440]

function intervalLabel(minutes: number): string {
    if (minutes === 1440) return "Una vez al día"
    if (minutes === 60) return "Cada hora"
    if (minutes % 60 === 0) return `Cada ${minutes / 60} horas`
    return `Cada ${minutes} minutos`
}

/** Línea de estado de la sincronización: qué pasa ahora y cuándo fue y será la siguiente. */
function describeSync(status: DriveStatusResponse, now: number): { text: string; error: boolean } {
    if (status.isScanning) return { text: "Buscando episodios nuevos…", error: false }
    if (!status.folderId) return { text: "Elige una carpeta para empezar a sincronizar.", error: false }
    if (!status.autoSync) {
        return { text: "La sincronización automática está apagada. Usa «Sincronizar ahora» para buscar novedades.", error: false }
    }
    const progress = status.progress
    if (progress?.phase === "error") {
        return { text: `El último escaneo falló: ${progress.error ?? "error desconocido"}. Se reintentará solo.`, error: true }
    }
    const parts: string[] = [
        progress?.finishedAt
            ? `Última sincronización: ${formatRelativeEs(new Date(progress.finishedAt), now)} (${progress.indexed} episodios)`
            : "Todavía no se ha sincronizado desde que arrancó KameHouse",
    ]
    if (status.nextScanAt) {
        parts.push(`Próxima: ${formatRelativeEs(new Date(status.nextScanAt), now)}`)
    }
    return { text: parts.join(" · "), error: false }
}

/**
 * Conexión con Google Drive: credenciales, cuenta, carpeta de la biblioteca y sincronización.
 * El escaneo también se sigue desde la sección "Escáner y catálogo en vivo".
 */
export function GoogleDriveCard() {
    const { watch, setValue, formState } = useFormContext<SettingsFormValues>()
    const queryClient = useQueryClient()
    const [rawIsConnecting, setRawIsConnecting] = useState(false)
    const [rawManualAuthUrl, setRawManualAuthUrl] = useState<string>("")
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [browsing, setBrowsing] = useState(false)
    // Enlace pegado a mano: es estado local hasta que se guarda al salir del campo.
    const [folderDraft, setFolderDraft] = useState<string | null>(null)
    const [now, setNow] = useState(() => Date.now())
    const expectedCallbackOrigin = useRef<string | null>(null)
    const completionNotified = useRef(false)
    const jsonFileInputRef = useRef<HTMLInputElement>(null)

    // Form / server watched values
    const googleDrive = watch("googleDrive")
    const clientId = googleDrive?.clientId ?? ""
    const clientSecret = googleDrive?.clientSecret ?? ""
    const redirectUri = `${getServerBaseUrl() || window.location.origin}/api/v1/drive/callback`

    // 1. Google Drive connection status (live scan progress is pushed via WS in WebsocketProvider)
    const { data: driveStatus, refetch: refetchStatus } = useDriveStatus()
    const selectFolder = useSelectDriveFolder()
    const updateSync = useUpdateDriveSync()
    const triggerScan = useTriggerDriveScan()

    const isConnected = Boolean(driveStatus?.connected)
    const isConfigured = driveStatus?.oauthConfigured ?? Boolean(clientId.trim() && clientSecret.trim())
    const isConnecting = rawIsConnecting && !isConnected
    const manualAuthUrl = isConnected ? "" : rawManualAuthUrl

    const savedFolderId = driveStatus?.folderId ?? ""
    const folderInput = folderDraft ?? savedFolderId
    // Sin carpeta elegida el selector se abre solo: es el paso natural después de conectar.
    const browserOpen = isConnected && (browsing || !savedFolderId)
    const autoSync = driveStatus?.autoSync ?? false
    const intervalMinutes = driveStatus?.scanIntervalMinutes || 60
    const isScanning = Boolean(driveStatus?.isScanning) || triggerScan.isPending
    const sync = isConnected && driveStatus ? describeSync(driveStatus, now) : null
    const intervalOptions = [...SYNC_INTERVAL_OPTIONS, ...(SYNC_INTERVAL_OPTIONS.includes(intervalMinutes) ? [] : [intervalMinutes])]
        .sort((a, b) => a - b)
        .map((minutes) => ({ value: String(minutes), label: intervalLabel(minutes) }))

    const needsCredentials = !isConfigured && !(clientId.trim() && clientSecret.trim())
    useEffect(() => {
        if (window.location.hash === "#google-drive-integration") {
            document.getElementById("google-drive-integration")?.scrollIntoView({ block: "start" })
        }
    }, [])

    // Reloj de la línea de estado: "hace 5 minutos" se actualiza sin pedir datos al servidor.
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 30000)
        return () => window.clearInterval(timer)
    }, [])

    // Listen for OAuth completion from popup window
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin === expectedCallbackOrigin.current && event.data?.type === "KAMEHOUSE_DRIVE_CONNECTED") {
                void refetchStatus().then(({ data }) => {
                    if (!data?.connected || completionNotified.current) return
                    completionNotified.current = true
                    toast.success("Google Drive conectado")
                    setRawIsConnecting(false)
                    setRawManualAuthUrl("")
                    queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
                })
            }
        }
        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [queryClient, refetchStatus])

    // The system browser has no window.opener in the desktop app. Check the
    // server while authorization is pending, and leave retry available on timeout.
    useEffect(() => {
        if (!isConnecting) return
        const interval = window.setInterval(() => {
            void refetchStatus().then(({ data }) => {
                if (!data?.connected || completionNotified.current) return
                completionNotified.current = true
                setRawIsConnecting(false)
                setRawManualAuthUrl("")
                toast.success("Google Drive conectado")
                queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
            })
        }, 3000)
        const timeout = window.setTimeout(() => setRawIsConnecting(false), 120000)
        return () => {
            window.clearInterval(interval)
            window.clearTimeout(timeout)
        }
    }, [isConnecting, queryClient, refetchStatus])

    // Helper to open link in system browser
    const openInBrowser = async (url: string) => {
        const desktopApi = typeof window !== "undefined" ? window.desktop : undefined
        if (desktopApi?.shell?.open) {
            try {
                await desktopApi.shell.open(url)
                return true
            } catch (e) {
                console.warn("[Drive] Desktop shell open failed, falling back to window.open", e)
            }
        }
        return window.open(url, "_blank") !== null
    }

    const applyOAuthJsonText = (raw: string): boolean => {
        const extracted = parseGoogleOAuthJson(raw)
        if (!extracted) return false
        if (extracted.clientId) {
            setValue("googleDrive.clientId", extracted.clientId, { shouldDirty: true })
        }
        if (extracted.clientSecret) {
            setValue("googleDrive.clientSecret", extracted.clientSecret, { shouldDirty: true })
        }
        toast.success("Credenciales OAuth cargadas desde el JSON")
        return true
    }

    const handleJsonFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ""
        if (!file) return
        try {
            const text = await file.text()
            if (!applyOAuthJsonText(text)) {
                toast.error("El archivo JSON no contiene client_id y client_secret válidos")
            }
        } catch {
            toast.error("No se pudo leer el archivo JSON")
        }
    }

    // 2. Start OAuth flow
    const handleConnect = async () => {
        const cleanClientId = clientId.trim()
        const cleanClientSecret = clientSecret.trim()

        if ((!cleanClientId || !cleanClientSecret) && !isConfigured) {
            setShowAdvanced(true)
            toast.info("Falta activar la conexión con Google una sola vez", {
                description:
                    "Carga el archivo de configuración de Google en el apartado avanzado. Después solo tendrás que elegir tu cuenta.",
            })
            return
        }

        setRawIsConnecting(true)
        completionNotified.current = false

        try {
            // Persist only entered credentials. Provisioned server credentials must not be
            // replaced with empty form values.
            const defaults = formState.defaultValues?.googleDrive
            const saveCredentials =
                Boolean(cleanClientId && cleanClientSecret) &&
                (!isConfigured ||
                    cleanClientId !== (defaults?.clientId ?? "").trim() ||
                    cleanClientSecret !== (defaults?.clientSecret ?? "").trim())
            if (saveCredentials)
                await buildApiQuery({
                    endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
                    method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0] as "PATCH",
                    data: {
                        googleDrive: { clientId: cleanClientId, clientSecret: cleanClientSecret },
                    },
                })

            const authRes = await buildApiQuery<{ data?: { url?: string; redirectUri?: string }; url?: string; redirectUri?: string }>({
                endpoint: API_ENDPOINTS.DRIVE.DriveAuthURL.endpoint,
                method: API_ENDPOINTS.DRIVE.DriveAuthURL.methods[0],
            })

            const authUrl = authRes?.data?.url ?? authRes?.url
            if (!authUrl) {
                throw new Error("No se pudo obtener el enlace de autorización")
            }
            const redirectUri = authRes?.data?.redirectUri ?? authRes?.redirectUri
            expectedCallbackOrigin.current = redirectUri ? new URL(redirectUri).origin : null

            setRawManualAuthUrl(authUrl)
            if (await openInBrowser(authUrl)) {
                toast.success("Abriendo Google en tu navegador…")
            } else {
                toast.info("Abre el enlace de Google para continuar", { description: "Tu navegador bloqueó la apertura automática." })
            }
        } catch (err) {
            setRawIsConnecting(false)
            toast.error(errorText(err, "No se pudo iniciar la conexión con Google"))
        }
    }

    // 3. Disconnect Drive
    const { mutate: disconnectDrive, isPending: isDisconnecting } = useMutation({
        mutationFn: async () => {
            await buildApiQuery({
                endpoint: API_ENDPOINTS.DRIVE.DriveDisconnect.endpoint,
                method: API_ENDPOINTS.DRIVE.DriveDisconnect.methods[0],
            })
        },
        onSuccess: () => {
            toast.success("Google Drive desconectado")
            setRawIsConnecting(false)
            setRawManualAuthUrl("")
            setBrowsing(false)
            setValue("googleDrive.refreshToken", "")
            setValue("googleDrive.enabled", false)
            refetchStatus()
            queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
        },
        onError: (err: unknown) => {
            const message = errorText(err, "No se pudo desconectar Google Drive")
            toast.error(message)
        },
    })

    // 4. Carpeta: se elige en el selector o pegando su enlace. Elegirla guarda y escanea enseguida.
    const chooseFolder = (folderId: string) => {
        selectFolder.mutate(folderId, {
            onSuccess: () => {
                setBrowsing(false)
                setFolderDraft(null)
            },
        })
    }

    const handleFolderBlur = () => {
        const next = extractFolderId(folderInput)
        if (!isConnected || !next || next === savedFolderId || selectFolder.isPending) return
        chooseFolder(next)
    }

    // 5. Sincronización automática: cambios inmediatos, como el resto de interruptores de biblioteca.
    const setAutoSync = (enabled: boolean) => updateSync.mutate({ disableAutoSync: !enabled })
    const changeInterval = (value: string) => updateSync.mutate({ scanIntervalMinutes: Number(value) })

    const copySingleUri = (uri: string) => {
        navigator.clipboard.writeText(uri)
        toast.success(`URI copiado: ${uri}`)
    }

    return (
        <SectionBar
            variant="content"
            id="google-drive-integration"
            label="Google Drive"
            description="Carpeta de tu Drive desde la que se transmiten series y películas, sin ocupar espacio en disco."
            icon={Cloud}
            collapsible
            defaultOpen={true}
            badge={
                isConnected ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-status-success/10 text-status-success border border-status-success/25">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
                        Conectado: {driveStatus?.userEmail || "Google Drive"}
                    </span>
                ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--neutral-elev-3)] text-on-surface-variant border border-[var(--neutral-separator)]">
                        Desconectado
                    </span>
                )
            }
        >
            <div className="space-y-6 pt-2">
                {/* Status Alert */}
                {isConnected ? (
                    <div className="p-4 rounded-xl bg-[var(--success-bg)] border border-[var(--success-border)] flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-status-success shrink-0" />
                            <div>
                                <h3 className="text-sm font-medium text-status-success">
                                    Cuenta vinculada: {driveStatus?.displayName || driveStatus?.userEmail}
                                </h3>
                                <p className="text-xs text-status-success/70">
                                    {driveStatus?.indexedEpisodes === 1
                                        ? "1 archivo de Google Drive"
                                        : `${driveStatus?.indexedEpisodes ?? 0} archivos de Google Drive`}{" "}
                                    en tu biblioteca.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                intent="outline"
                                size="sm"
                                onClick={() => disconnectDrive()}
                                disabled={isDisconnecting}
                                leftIcon={<Unlink className="w-3.5 h-3.5" />}
                                iconSpacing="0.375rem"
                                className="text-status-error border-status-error/40"
                            >
                                Desconectar
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-on-surface-variant">
                            Elige tu cuenta de Google y acepta el acceso para reproducir tus archivos de Drive.
                        </p>
                        <Button
                            intent="primary"
                            size="md"
                            onClick={handleConnect}
                            loading={isConnecting}
                            leftIcon={!isConnecting ? <Cloud className="w-4 h-4" /> : undefined}
                            iconSpacing="0.5rem"
                        >
                            {needsCredentials ? "Configurar acceso a Drive" : "Conectar con Google"}
                        </Button>
                        {needsCredentials && (
                            <p className="text-xs text-on-surface-variant" role="status">
                                Carga las credenciales de Google una vez. Después podrás elegir tu cuenta.
                            </p>
                        )}
                        {isConnecting && (
                            <p className="text-xs text-on-surface-variant" role="status">
                                Completa la autorización en tu navegador. Esta pantalla detectará la conexión.
                            </p>
                        )}
                    </div>
                )}

                {/* Carpeta de la biblioteca: selector de Drive y, como alternativa, el enlace pegado */}
                {isConnected && (
                    <div id="google-drive-folder" className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-on-surface">Carpeta de series y películas</p>
                                <p className="text-sm text-on-surface truncate" title={driveStatus?.folderName}>
                                    {driveStatus?.folderName || (savedFolderId ? "Carpeta elegida" : "Todavía no has elegido una carpeta")}
                                </p>
                            </div>
                            {savedFolderId && !browserOpen && (
                                <Button
                                    intent="secondary"
                                    size="sm"
                                    onClick={() => setBrowsing(true)}
                                    leftIcon={<FolderSearch className="w-3.5 h-3.5" />}
                                    iconSpacing="0.375rem"
                                >
                                    Cambiar carpeta
                                </Button>
                            )}
                        </div>

                        {browserOpen && (
                            <GoogleDriveFolderBrowser
                                startFolderId={savedFolderId}
                                selecting={selectFolder.isPending}
                                onSelect={chooseFolder}
                                onCancel={savedFolderId ? () => setBrowsing(false) : undefined}
                            />
                        )}

                        <div className="space-y-1.5">
                            <label htmlFor="gdrive-folder-id" className="text-xs font-medium text-on-surface">
                                ¿Tienes el enlace de la carpeta? Pégalo aquí
                            </label>
                            <div className="flex gap-2">
                                <input
                                    id="gdrive-folder-id"
                                    type="text"
                                    value={folderInput}
                                    onChange={(e) => setFolderDraft(extractFolderId(e.target.value))}
                                    onBlur={handleFolderBlur}
                                    placeholder="https://drive.google.com/drive/folders/…"
                                    className={cn(InputAnatomy.root(), "flex-1 font-mono")}
                                />
                                {selectFolder.isPending && <IconUiSpinner className="w-4 h-4 animate-spin text-brand-accent self-center shrink-0" />}
                            </div>
                        </div>
                    </div>
                )}

                {/* Sincronización automática y estado del último escaneo */}
                {isConnected && (
                    <div className="space-y-3 pt-3 border-t border-[var(--neutral-separator)]">
                        <OsToggle
                            label="Escanear Drive automáticamente"
                            description="Busca episodios nuevos al abrir KameHouse, al cambiar de carpeta y cada cierto tiempo. No tienes que pulsar nada."
                            checked={autoSync}
                            onChange={setAutoSync}
                            disabled={updateSync.isPending}
                        />
                        <OsSelect
                            label="Frecuencia"
                            description="Cada cuánto busca novedades mientras la sincronización automática esté encendida."
                            options={intervalOptions}
                            value={String(intervalMinutes)}
                            onChange={changeInterval}
                            disabled={!autoSync || updateSync.isPending}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                            <p
                                role="status"
                                aria-live="polite"
                                className={cn("text-xs", sync?.error ? "text-status-error" : "text-on-surface-variant")}
                            >
                                {sync?.text}
                            </p>
                            <Button
                                intent="secondary"
                                size="sm"
                                onClick={() => triggerScan.mutate()}
                                disabled={isScanning || !savedFolderId}
                                loading={triggerScan.isPending}
                                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                                iconSpacing="0.375rem"
                            >
                                Sincronizar ahora
                            </Button>
                        </div>
                    </div>
                )}

                <details open={showAdvanced} onToggle={(event) => setShowAdvanced(event.currentTarget.open)}>
                    <summary className="cursor-pointer text-sm text-on-surface-variant focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent rounded-xl py-3">
                        Configuración avanzada
                    </summary>
                    <div className="space-y-4 pt-3">
                        {!isConnected && (
                            <div className="p-4 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-shadow)] space-y-3">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
                                    <div className="text-xs text-on-surface-variant space-y-1">
                                        <p className="font-medium text-on-surface">Activación inicial de la aplicación</p>
                                        <p>
                                            Carga el archivo JSON de Google para completar los datos automáticamente. Se guardarán para las
                                            próximas conexiones.
                                        </p>
                                        <p>
                                            Si usas un cliente OAuth de tipo aplicación web, añade esta dirección de retorno en Google
                                            Cloud. Es la dirección de esta instalación; no tienes que abrirla en el navegador.
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-[var(--neutral-elev-0)] border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-inset-shadow)] rounded-lg p-2 font-mono text-xs text-status-success space-y-1">
                                    <button
                                        type="button"
                                        onClick={() => copySingleUri(redirectUri)}
                                        className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-[var(--neutral-elev-3)] text-left transition-colors group"
                                        title="Haz clic para copiar este URI"
                                    >
                                        <span className="break-all">{redirectUri}</span>
                                        <span className="text-2xs text-on-surface-variant opacity-70 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 inline-flex items-center gap-1 font-sans">
                                            <Copy className="w-3 h-3" /> Copiar
                                        </span>
                                    </button>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                    <a
                                        href="https://console.cloud.google.com/apis/credentials"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-brand-accent-readable hover:underline text-xs inline-flex items-center gap-1 font-medium"
                                    >
                                        Abrir Google Cloud Console <ExternalLink className="w-3 h-3" />
                                    </a>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            ref={jsonFileInputRef}
                                            type="file"
                                            accept=".json,application/json"
                                            onChange={handleJsonFileChange}
                                            className="hidden"
                                        />
                                        <Button
                                            intent="secondary"
                                            size="sm"
                                            onClick={() => jsonFileInputRef.current?.click()}
                                            leftIcon={<Upload className="w-3.5 h-3.5" />}
                                            iconSpacing="0.375rem"
                                        >
                                            Cargar JSON de Google
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Credentials Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="gdrive-client-id"
                                    className="text-xs font-medium text-on-surface flex items-center justify-between"
                                >
                                    <span>ID de cliente</span>
                                    {!clientId.trim() && <span className="text-2xs text-on-surface-variant">Requerido</span>}
                                </label>
                                <input
                                    id="gdrive-client-id"
                                    type="text"
                                    value={clientId}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        if (applyOAuthJsonText(val)) return
                                        setValue("googleDrive.clientId", val, { shouldDirty: true })
                                    }}
                                    placeholder="Ej: 7483...apps.googleusercontent.com"
                                    className={cn(InputAnatomy.root(), "font-mono")}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="gdrive-client-secret"
                                    className="text-xs font-medium text-on-surface flex items-center justify-between"
                                >
                                    <span>Secreto de cliente</span>
                                    {!clientSecret.trim() && <span className="text-2xs text-on-surface-variant">Requerido</span>}
                                </label>
                                <input
                                    id="gdrive-client-secret"
                                    type="password"
                                    value={clientSecret}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        if (applyOAuthJsonText(val)) return
                                        setValue("googleDrive.clientSecret", val, { shouldDirty: true })
                                    }}
                                    placeholder="Ej: GOCSPX-..."
                                    className={cn(InputAnatomy.root(), "font-mono")}
                                />
                            </div>
                        </div>
                    </div>
                </details>

                {/* Manual link / fallback banner */}
                {manualAuthUrl && !isConnected && (
                    <div className="p-4 rounded-xl bg-brand-accent/10 border border-brand-accent/30 space-y-3 animate-in fade-in duration-base">
                        <div className="flex items-start gap-2.5">
                            <ExternalLink className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
                            <div className="text-xs text-on-surface space-y-1">
                                <p className="font-medium text-brand-accent-readable">Enlace de autorización listo</p>
                                <p className="text-on-surface-variant">
                                    Si tu navegador no se abrió solo, usa el botón o copia el enlace y ábrelo a mano:
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button
                                intent="primary"
                                size="sm"
                                onClick={() => openInBrowser(manualAuthUrl)}
                                leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                                iconSpacing="0.375rem"
                            >
                                Abrir en el navegador
                            </Button>
                            <Button
                                intent="secondary"
                                size="sm"
                                onClick={() => {
                                    navigator.clipboard.writeText(manualAuthUrl)
                                    toast.success("Enlace copiado al portapapeles")
                                }}
                                leftIcon={<Copy className="w-3.5 h-3.5" />}
                                iconSpacing="0.375rem"
                            >
                                Copiar enlace
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </SectionBar>
    )
}
