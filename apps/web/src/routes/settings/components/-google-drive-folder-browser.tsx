import { useState } from "react"
import { ChevronRight, Folder, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IconUiSpinner } from "@/components/ui/icons"
import { DRIVE_ROOT_FOLDER_ID, useDriveFolders } from "@/lib/drive-status"

interface GoogleDriveFolderBrowserProps {
    /** Carpeta desde la que empieza el selector: la elegida hoy o Mi unidad. */
    startFolderId: string
    selecting: boolean
    onSelect: (folderId: string) => void
    /** Sin carpeta elegida no hay nada a lo que volver: el botón de cancelar no aparece. */
    onCancel?: () => void
}

/**
 * Selector de carpetas de Google Drive: navegas por tus carpetas y eliges la que contiene
 * las series y películas. Así no hace falta copiar identificadores a mano.
 */
export function GoogleDriveFolderBrowser({ startFolderId, selecting, onSelect, onCancel }: GoogleDriveFolderBrowserProps) {
    const [parentId, setParentId] = useState(startFolderId || DRIVE_ROOT_FOLDER_ID)
    const listing = useDriveFolders(parentId)
    const data = listing.data

    return (
        <div
            role="region"
            aria-label="Elegir carpeta de Google Drive"
            className="rounded-2xl border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] bg-[var(--neutral-elev-2)] shadow-[shadow:var(--double-bezel-shadow)] p-3 sm:p-4 space-y-3"
        >
            <nav aria-label="Ruta de la carpeta" className="flex flex-wrap items-center gap-1 text-xs min-h-[1.5rem]">
                {data?.path.map((crumb, index) => {
                    const isCurrent = index === data.path.length - 1
                    return (
                        <span key={`${crumb.id}-${index}`} className="inline-flex items-center gap-1 min-w-0">
                            {index > 0 && <ChevronRight className="w-3 h-3 shrink-0 text-on-surface-variant" aria-hidden="true" />}
                            {isCurrent ? (
                                <span aria-current="location" className="font-semibold text-on-surface truncate max-w-[16rem]">
                                    {crumb.name}
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setParentId(crumb.id)}
                                    className="text-brand-accent-readable hover:underline truncate max-w-[12rem]"
                                >
                                    {crumb.name}
                                </button>
                            )}
                        </span>
                    )
                })}
            </nav>

            <div className="max-h-60 overflow-y-auto rounded-xl border border-[var(--neutral-separator)] bg-[var(--neutral-elev-0)]">
                {listing.isPending ? (
                    <div role="status" className="flex items-center justify-center gap-2 p-4 text-xs text-on-surface-variant">
                        <IconUiSpinner className="w-4 h-4 animate-spin text-brand-accent" />
                        Cargando carpetas…
                    </div>
                ) : listing.isError ? (
                    <div role="alert" className="p-4 space-y-2 text-xs text-on-surface-variant">
                        <p>No se pudieron leer las carpetas de Google Drive.</p>
                        <Button
                            intent="secondary"
                            size="sm"
                            onClick={() => void listing.refetch()}
                            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                            iconSpacing="0.375rem"
                        >
                            Reintentar
                        </Button>
                    </div>
                ) : data && data.folders.length > 0 ? (
                    <ul className="divide-y divide-[var(--neutral-separator)]">
                        {data.folders.map((folder) => (
                            <li key={folder.id}>
                                <button
                                    type="button"
                                    onClick={() => setParentId(folder.id)}
                                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-[var(--neutral-elev-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
                                >
                                    <span className="flex items-center gap-2 min-w-0">
                                        <Folder className="w-4 h-4 shrink-0 text-brand-accent" aria-hidden="true" />
                                        <span className="truncate text-on-surface">{folder.name}</span>
                                    </span>
                                    <ChevronRight className="w-4 h-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="p-4 text-xs text-on-surface-variant">No hay subcarpetas aquí.</p>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-on-surface-variant">Se escanean también todas las subcarpetas de la carpeta elegida.</p>
                <div className="flex items-center gap-2">
                    {onCancel && (
                        <Button intent="secondary" size="sm" onClick={onCancel} disabled={selecting}>
                            Cancelar
                        </Button>
                    )}
                    <Button
                        intent="primary"
                        size="sm"
                        onClick={() => onSelect(parentId)}
                        loading={selecting}
                        disabled={selecting || listing.isPending}
                    >
                        Usar esta carpeta
                    </Button>
                </div>
            </div>
        </div>
    )
}
