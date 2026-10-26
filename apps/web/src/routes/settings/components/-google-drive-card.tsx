import { errorText } from "@/api/client/error-messages"
import { useState, useEffect } from "react"
import { useFormContext } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { SectionBar } from "@/components/ui/sectionbar"
import { Button } from "@/components/ui/button"
import { InputAnatomy } from "@/components/ui/input/input-parts"
import { cn } from "@/components/ui/core/styling"
import { Cloud, ExternalLink, CheckCircle2, AlertCircle, Unlink, Copy } from "lucide-react"
import { IconUiSpinner } from "@/components/ui/icons"
import { toast } from "sonner"
import { buildApiQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { useDriveStatus } from "@/lib/drive-status"
import type { SettingsFormValues } from "../index"

function extractFolderId(input: string): string {
    const trimmed = input.trim()
    const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    if (match && match[1]) {
        return match[1]
    }
    return trimmed
}

/**
 * Conexión con Google Drive: credenciales, cuenta y carpeta raíz.
 * Escanear y seguir el progreso se hace desde la sección "Escáner de la biblioteca",
 * que junta el disco local y Drive en un solo lugar.
 */
export function GoogleDriveCard() {
    const { watch, setValue, formState, resetField } = useFormContext<SettingsFormValues>()
    const queryClient = useQueryClient()
    const [rawIsConnecting, setRawIsConnecting] = useState(false)
    const [rawManualAuthUrl, setRawManualAuthUrl] = useState<string>("")

    // Form / server watched values
    const googleDrive = watch("googleDrive")
    const clientId = googleDrive?.clientId ?? ""
    const clientSecret = googleDrive?.clientSecret ?? ""
    const folderId = googleDrive?.folderId ?? ""

    // 1. Google Drive connection status (live scan progress is pushed via WS in WebsocketProvider)
    const { data: driveStatus, refetch: refetchStatus } = useDriveStatus()

    const isConnected = Boolean(driveStatus?.connected)
    const isConnecting = rawIsConnecting && !isConnected
    const manualAuthUrl = isConnected ? "" : rawManualAuthUrl

    // Listen for OAuth completion from popup window
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === "KAMEHOUSE_DRIVE_CONNECTED") {
                toast.success("Google Drive conectado")
                setRawIsConnecting(false)
                setRawManualAuthUrl("")
                refetchStatus()
                queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
            }
        }
        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [queryClient, refetchStatus])

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
        window.open(url, "_blank")
        return true
    }

    // 2. Start OAuth flow
    const handleConnect = async () => {
        const cleanClientId = clientId.trim()
        const cleanClientSecret = clientSecret.trim()
        const cleanFolderId = extractFolderId(folderId)

        if (!cleanClientId || !cleanClientSecret) {
            toast.error("Escribe el ID y el secreto de cliente antes de conectar")
            return
        }

        setRawIsConnecting(true)

        try {
            // First save credentials
            await buildApiQuery({
                endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
                method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0] as "PATCH",
                data: {
                    googleDrive: {
                        clientId: cleanClientId,
                        clientSecret: cleanClientSecret,
                        folderId: cleanFolderId,
                    },
                },
            })

            const authRes = await buildApiQuery<{ data?: { url?: string }; url?: string }, { clientId: string }>({
                endpoint: API_ENDPOINTS.DRIVE.DriveAuthURL.endpoint,
                method: API_ENDPOINTS.DRIVE.DriveAuthURL.methods[0],
                params: { clientId: cleanClientId },
            })

            const authUrl = authRes?.data?.url ?? authRes?.url
            if (!authUrl) {
                throw new Error("No se pudo obtener el enlace de autorización")
            }

            setRawManualAuthUrl(authUrl)
            await openInBrowser(authUrl)
            toast.success("Abriendo Google en tu navegador…")
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

    // 4. La carpeta raíz se guarda al salir del campo: así cualquier botón de
    // escaneo (en la sección Escáner) usa la carpeta vigente sin Guardar global.
    const { mutate: saveFolderId, isPending: isSavingFolder } = useMutation({
        mutationFn: async (nextFolderId: string) => {
            await buildApiQuery({
                endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
                method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0] as "PATCH",
                data: { googleDrive: { folderId: nextFolderId } },
            })
        },
        onSuccess: () => {
            toast.success("Carpeta de Google Drive guardada")
            queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SETTINGS.GetSettings.key] })
        },
        onError: (err: unknown) => {
            toast.error(errorText(err, "No se pudo guardar la carpeta de Drive"))
        },
    })
    const handleFolderBlur = () => {
        const next = folderId.trim()
        const saved = (formState.defaultValues?.googleDrive?.folderId ?? "").trim()
        if (!isConnected || !next || next === saved || isSavingFolder) return
        saveFolderId(next, {
            // Marca la carpeta como guardada para que Guardar global no la vea pendiente.
            onSuccess: () => resetField("googleDrive.folderId", { defaultValue: next }),
        })
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
                    <span className="flex items-center gap-1.5 text-3xs font-medium px-2 py-0.5 rounded-full bg-status-success/10 text-status-success border border-status-success/25">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
                        Conectado: {driveStatus?.userEmail || "Google Drive"}
                    </span>
                ) : (
                    <span className="text-3xs px-2 py-0.5 rounded-full bg-[var(--neutral-elev-3)] text-on-surface-variant border border-[var(--neutral-separator)]">
                        Desconectado
                    </span>
                )
            }
        >
            <div className="space-y-6 pt-2">
                {/* Status Alert */}
                {isConnected ? (
                    <div className="p-4 rounded-xl bg-[var(--success-bg)] border border-[var(--success-border)] flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-status-success shrink-0" />
                            <div>
                                <h3 className="text-sm font-medium text-status-success">
                                    Cuenta vinculada: {driveStatus?.displayName || driveStatus?.userEmail}
                                </h3>
                                <p className="text-xs text-status-success/70">
                                    {driveStatus?.indexedEpisodes === 1 ? "1 archivo de Google Drive" : `${driveStatus?.indexedEpisodes ?? 0} archivos de Google Drive`} en tu biblioteca.
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
                    <div className="p-4 rounded-xl bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] space-y-3">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
                            <div className="text-xs text-on-surface-variant space-y-1">
                                <p className="font-medium text-on-surface">Configura esto en Google Cloud Console:</p>
                                <p>
                                    En tu cliente OAuth 2.0 (aplicación web), añade estos <strong>URI de redireccionamiento autorizados</strong>. Sin ellos, Google bloquea la conexión con el error <em>redirect_uri_mismatch</em>:
                                </p>
                            </div>
                        </div>
                        <div className="bg-black/40 border border-[var(--neutral-separator)] rounded-lg p-3 font-mono text-2xs text-status-success space-y-1">
                            <div>http://127.0.0.1:43212/api/v1/drive/callback</div>
                            <div>http://localhost:43212/api/v1/drive/callback</div>
                            <div>http://127.0.0.1:43211/api/v1/drive/callback</div>
                            <div>http://localhost:43211/api/v1/drive/callback</div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                            <a
                                href="https://console.cloud.google.com/apis/credentials"
                                target="_blank"
                                rel="noreferrer"
                                className="text-brand-accent-readable hover:underline text-xs inline-flex items-center gap-1 font-medium"
                            >
                                Abrir Google Cloud Console <ExternalLink className="w-3 h-3" />
                            </a>
                            <Button
                                intent="secondary"
                                size="sm"
                                onClick={() => {
                                    const uris = "http://127.0.0.1:43212/api/v1/drive/callback\nhttp://localhost:43212/api/v1/drive/callback\nhttp://127.0.0.1:43211/api/v1/drive/callback\nhttp://localhost:43211/api/v1/drive/callback"
                                    navigator.clipboard.writeText(uris)
                                    toast.success("URI copiados al portapapeles")
                                }}
                                leftIcon={<Copy className="w-3.5 h-3.5" />}
                                iconSpacing="0.375rem"
                            >
                                Copiar URI
                            </Button>
                        </div>
                    </div>
                )}

                {/* Credentials Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label htmlFor="gdrive-client-id" className="text-xs font-medium text-on-surface flex items-center justify-between">
                            <span>ID de cliente</span>
                        </label>
                        <input
                            id="gdrive-client-id"
                            type="text"
                            value={clientId}
                            onChange={(e) => {
                                setValue("googleDrive.clientId", e.target.value, { shouldDirty: true })
                            }}
                            placeholder="7483...apps.googleusercontent.com"
                            className={cn(InputAnatomy.root(), "font-mono")}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="gdrive-client-secret" className="text-xs font-medium text-on-surface flex items-center justify-between">
                            <span>Secreto de cliente</span>
                        </label>
                        <input
                            id="gdrive-client-secret"
                            type="password"
                            value={clientSecret}
                            onChange={(e) => {
                                setValue("googleDrive.clientSecret", e.target.value, { shouldDirty: true })
                            }}
                            placeholder="GOCSPX-..."
                            className={cn(InputAnatomy.root(), "font-mono")}
                        />
                    </div>
                </div>

                {/* Folder ID input */}
                <div className="space-y-1.5">
                    <label htmlFor="gdrive-folder-id" className="text-xs font-medium text-on-surface flex items-center justify-between">
                        <span>ID de la carpeta raíz de Drive</span>
                        <span className="text-3xs text-on-surface-variant">
                            Pega el ID o la URL completa de drive.google.com/drive/folders/<strong>ID</strong>
                        </span>
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="gdrive-folder-id"
                            type="text"
                            value={folderId}
                            onChange={(e) => {
                                const cleaned = extractFolderId(e.target.value)
                                setValue("googleDrive.folderId", cleaned, { shouldDirty: true })
                            }}
                            onBlur={handleFolderBlur}
                            placeholder="1aBcDeFgHiJkLmNoPqRsTuVwXyZ..."
                            className={cn(InputAnatomy.root(), "flex-1 font-mono")}
                        />
                        {isSavingFolder && <IconUiSpinner className="w-4 h-4 animate-spin text-brand-accent self-center shrink-0" />}
                    </div>
                </div>

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

                {/* Connect button if not connected */}
                {!isConnected && (
                    <div className="pt-2 flex justify-end">
                        <Button
                            intent="primary"
                            size="md"
                            onClick={handleConnect}
                            loading={isConnecting}
                            disabled={!clientId.trim() || !clientSecret.trim()}
                            leftIcon={!isConnecting ? <Cloud className="w-4 h-4" /> : undefined}
                            iconSpacing="0.5rem"
                        >
                            Conectar con Google Drive
                        </Button>
                    </div>
                )}
            </div>
        </SectionBar>
    )
}
