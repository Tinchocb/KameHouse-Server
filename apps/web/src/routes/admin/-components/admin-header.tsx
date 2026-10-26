import { useRouter, useNavigate } from "@tanstack/react-router"
import { Button, IconButton } from "@/components/ui/button"
import { IconNavigationChevronLeft, IconUiDownload, IconStatusFile } from "@/components/ui/icons"
import { useBackupDatabase, useDownloadDatabaseBackup } from "@/api/hooks/system.hooks"
import { useDownloadDiagnosticsReport } from "@/api/hooks/diagnostics.hooks"
import { toast } from "sonner"

export function AdminHeader() {
    const { mutate: backupDb, isPending: isBackingUp } = useBackupDatabase()
    const { download: downloadReport, isDownloading: isDownloadingReport } = useDownloadDiagnosticsReport()
    const { download: downloadBackup, isDownloading: isDownloadingBackup } = useDownloadDatabaseBackup()

    const router = useRouter()
    const navigate = useNavigate()
    // Vuelve a la pantalla anterior de la app; si se entró directo a Administración, va a Ajustes.
    const goBack = () => {
        if (router.history.canGoBack()) router.history.back()
        else navigate({ to: "/settings" })
    }

    const handleBackup = () => {
        backupDb(undefined, {
            onSuccess: () => {
                toast.success("Respaldo creado")
                void downloadBackup()
            },
            onError: () => {
                toast.error("No se pudo crear el respaldo")
            }
        })
    }

    return (
        <header className="relative z-10">
            <div className="w-full">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-4">
                    <div className="flex items-start gap-3 sm:gap-4">
                        <IconButton
                            intent="outline"
                            size="md"
                            onClick={goBack}
                            aria-label="Volver"
                            title="Volver"
                            icon={<IconNavigationChevronLeft className="w-4 h-4" />}
                            className="shrink-0 mt-1"
                        />
                        <div>
                            <h1 className="type-title text-on-surface">Panel de administración</h1>
                            <p className="text-body-md text-label-2 mt-2">Gestiona y monitorea KameHouse</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 w-full sm:w-auto flex-wrap">
                        <Button
                            intent="outline"
                            onClick={handleBackup}
                            disabled={isBackingUp || isDownloadingBackup}
                            loading={isBackingUp || isDownloadingBackup}
                            leftIcon={<IconUiDownload size={16} strokeWidth={2.5} />}
                            className="flex-1 sm:flex-initial"
                        >
                            {isBackingUp ? "Creando…" : isDownloadingBackup ? "Descargando…" : "Respaldo"}
                        </Button>
                        <Button
                            intent="outline"
                            onClick={downloadReport}
                            disabled={isDownloadingReport}
                            loading={isDownloadingReport}
                            leftIcon={<IconStatusFile size={16} strokeWidth={2.5} />}
                            className="flex-1 sm:flex-initial"
                        >
                            {isDownloadingReport ? "Descargando…" : "Diagnóstico"}
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    )
}
