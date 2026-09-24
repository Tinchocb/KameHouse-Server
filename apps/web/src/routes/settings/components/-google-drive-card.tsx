import React, { useState, useEffect } from "react"
import { useFormContext } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { SectionBar } from "@/components/ui/sectionbar"
import { Cloud, ExternalLink, CheckCircle2, AlertCircle, Unlink, Copy } from "lucide-react"
import { IconUiSpinner } from "@/components/ui/icons"
import { toast } from "sonner"
import { buildSeaQuery } from "@/api/client/requests"
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
 * Escanear y seguir el progreso se hace desde la sección "Escáner de Biblioteca",
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
                toast.success("¡Google Drive conectado exitosamente!")
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
            toast.error("Ingresa el Client ID y Client Secret antes de conectar")
            return
        }

        setRawIsConnecting(true)

        try {
            // First save credentials
            await buildSeaQuery({
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

            const authRes = await buildSeaQuery<{ data?: { url?: string }; url?: string }, { clientId: string }>({
                endpoint: API_ENDPOINTS.DRIVE.DriveAuthURL.endpoint,
                method: API_ENDPOINTS.DRIVE.DriveAuthURL.methods[0],
                params: { clientId: cleanClientId },
            })

            const authUrl = authRes?.data?.url ?? authRes?.url
            if (!authUrl) {
                throw new Error("No se pudo obtener la URL de autorización")
            }

            setRawManualAuthUrl(authUrl)
            await openInBrowser(authUrl)
            toast.success("Abriendo Google en tu navegador...")
        } catch (err) {
            setRawIsConnecting(false)
            toast.error(err instanceof Error ? err.message : "Error al iniciar conexión con Google")
        }
    }

    // 3. Disconnect Drive
    const { mutate: disconnectDrive, isPending: isDisconnecting } = useMutation({
        mutationFn: async () => {
            await buildSeaQuery({
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
            const message = err instanceof Error ? err.message : "Error al desconectar Google Drive"
            toast.error(message)
        },
    })

    // 4. La carpeta raíz se guarda al salir del campo: así cualquier botón de
    // escaneo (en la sección Escáner) usa la carpeta vigente sin Guardar global.
    const { mutate: saveFolderId, isPending: isSavingFolder } = useMutation({
        mutationFn: async (nextFolderId: string) => {
            await buildSeaQuery({
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
            toast.error(err instanceof Error ? err.message : "No se pudo guardar la carpeta de Drive")
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
            id="google-drive-integration"
            label="Google Drive"
            description="Carpeta de tu Drive desde la que se transmiten series y películas, sin ocupar espacio en disco."
            icon={Cloud}
            collapsible
            defaultOpen={true}
            badge={
                isConnected ? (
                    <span className="flex items-center gap-1.5 text-3xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Conectado: {driveStatus?.userEmail || "Google Drive"}
                    </span>
                ) : (
                    <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant border border-white/10">
                        Desconectado
                    </span>
                )
            }
        >
            <div className="space-y-6 pt-2">
                {/* Status Alert */}
                {isConnected ? (
                    <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                            <div>
                                <h4 className="text-sm font-medium text-emerald-200">
                                    Cuenta vinculada: {driveStatus?.displayName || driveStatus?.userEmail}
                                </h4>
                                <p className="text-xs text-emerald-300/70">
                                    {driveStatus?.indexedEpisodes ?? 0} archivos de Google Drive indexados en tu biblioteca.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => disconnectDrive()}
                                disabled={isDisconnecting}
                                className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                                <Unlink className="w-3.5 h-3.5" />
                                Desconectar
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
                            <div className="text-xs text-on-surface-variant space-y-1">
                                <p className="font-medium text-on-surface">Configuración en Google Cloud Console:</p>
                                <p>
                                    En tu cliente OAuth 2.0 (Aplicación web), debes agregar los siguientes <strong>URIs de redireccionamiento autorizados</strong> para que Google no bloquee la conexión con <em>redirect_uri_mismatch</em>:
                                </p>
                            </div>
                        </div>
                        <div className="bg-black/40 border border-white/10 rounded-lg p-3 font-mono text-2xs text-emerald-400 space-y-1">
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
                                className="text-brand-accent hover:underline text-xs inline-flex items-center gap-1 font-medium"
                            >
                                Abrir Google Cloud Console <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                                type="button"
                                onClick={() => {
                                    const uris = "http://127.0.0.1:43212/api/v1/drive/callback\nhttp://localhost:43212/api/v1/drive/callback\nhttp://127.0.0.1:43211/api/v1/drive/callback\nhttp://localhost:43211/api/v1/drive/callback"
                                    navigator.clipboard.writeText(uris)
                                    toast.success("URIs copiados al portapapeles")
                                }}
                                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center gap-1 transition-colors border border-white/10"
                            >
                                <Copy className="w-3 h-3" />
                                Copiar URIs
                            </button>
                        </div>
                    </div>
                )}

                {/* Credentials Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label htmlFor="gdrive-client-id" className="text-xs font-medium text-on-surface flex items-center justify-between">
                            <span>Client ID</span>
                        </label>
                        <input
                            id="gdrive-client-id"
                            type="text"
                            value={clientId}
                            onChange={(e) => {
                                setValue("googleDrive.clientId", e.target.value, { shouldDirty: true })
                            }}
                            placeholder="7483...apps.googleusercontent.com"
                            className="w-full px-3 py-2 rounded-lg bg-surface-variant/40 border border-white/10 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 transition-colors font-mono"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="gdrive-client-secret" className="text-xs font-medium text-on-surface flex items-center justify-between">
                            <span>Client Secret</span>
                        </label>
                        <input
                            id="gdrive-client-secret"
                            type="password"
                            value={clientSecret}
                            onChange={(e) => {
                                setValue("googleDrive.clientSecret", e.target.value, { shouldDirty: true })
                            }}
                            placeholder="GOCSPX-..."
                            className="w-full px-3 py-2 rounded-lg bg-surface-variant/40 border border-white/10 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 transition-colors font-mono"
                        />
                    </div>
                </div>

                {/* Folder ID input */}
                <div className="space-y-1.5">
                    <label htmlFor="gdrive-folder-id" className="text-xs font-medium text-on-surface flex items-center justify-between">
                        <span>Folder ID de Google Drive (Carpeta Raíz ej. COLECCION_DB o serie)</span>
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
                            className="flex-1 px-3 py-2 rounded-lg bg-surface-variant/40 border border-white/10 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 transition-colors font-mono"
                        />
                        {isSavingFolder && <IconUiSpinner className="w-4 h-4 animate-spin text-brand-accent self-center shrink-0" />}
                    </div>
                </div>

                {/* Manual link / fallback banner */}
                {manualAuthUrl && !isConnected && (
                    <div className="p-4 rounded-xl bg-brand-accent/10 border border-brand-accent/30 space-y-3 animate-in fade-in duration-300">
                        <div className="flex items-start gap-2.5">
                            <ExternalLink className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
                            <div className="text-xs text-on-surface space-y-1">
                                <p className="font-medium text-brand-accent">Enlace de Autorización Generado</p>
                                <p className="text-on-surface-variant">
                                    Si no se abrió automáticamente tu navegador, haz clic en el botón de abajo o copia el enlace para abrirlo manualmente en Chrome/Edge:
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => openInBrowser(manualAuthUrl)}
                                className="px-3.5 py-1.5 rounded-lg bg-brand-accent hover:brightness-110 text-on-primary font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Abrir en el Navegador
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(manualAuthUrl)
                                    toast.success("Enlace copiado al portapapeles")
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center gap-1.5 transition-all border border-white/15 active:scale-95"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Copiar Enlace
                            </button>
                        </div>
                    </div>
                )}

                {/* Connect button if not connected */}
                {!isConnected && (
                    <div className="pt-2 flex justify-end">
                        <button
                            type="button"
                            onClick={handleConnect}
                            disabled={isConnecting || !clientId.trim() || !clientSecret.trim()}
                            className="px-5 py-2.5 rounded-xl bg-brand-accent hover:brightness-110 text-on-primary font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isConnecting ? (
                                <IconUiSpinner className="w-4 h-4 animate-spin" />
                            ) : (
                                <Cloud className="w-4 h-4" />
                            )}
                            Conectar con Google Drive
                        </button>
                    </div>
                )}
            </div>
        </SectionBar>
    )
}
