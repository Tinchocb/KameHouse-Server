import { useDirectorySelector } from "@/api/hooks/directory_selector.hooks"

import { Button, IconButton } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { Modal } from "@/components/ui/modal"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TextInput, TextInputProps } from "@/components/ui/text-input"
import { useBoolean } from "@/hooks/use-disclosure"
import { upath } from "@/lib/helpers/upath"
import { __isDesktop__ } from "@/types/constants"
import React from "react"
import { IconStatusFolder, IconUiSpinner, IconUiCheck, IconUiClose, IconStatusFolderOpen, IconNavigationChevronLeft, IconNavigationChevronRight } from "@/components/ui/icons";
import { useDebounce } from "use-debounce"

export type DirectorySelectorProps = {
    onSelect: (path: string) => void
    shouldExist?: boolean
    value: string
    /** Acción extra al final de la barra (ej. botón "Agregar" de PathList). */
    trailingAction?: React.ReactNode
} & Omit<TextInputProps, "onSelect" | "value">

export const DirectorySelector = React.memo(React.forwardRef<HTMLInputElement, DirectorySelectorProps>(function DirectorySelector(props, ref) {

    const {
        onSelect,
        value,
        shouldExist,
        label,
        trailingAction,
        ...rest
    } = props

    const sanitizePath = React.useCallback((path: string) => {
        if (!path) return ""
        return upath.normalizeSafe(path.replace(/[<>"]/g, ""))
    }, [])

    const [input, setInputRaw] = React.useState("")
    const [debouncedInput] = useDebounce(input, 300)
    const selectorState = useBoolean(false)
    const [isNativeOpening, setIsNativeOpening] = React.useState(false)

    const setInput = React.useCallback((newInput: string) => {
        setInputRaw(sanitizePath(newInput))
    }, [sanitizePath])

    const { data, isLoading } = useDirectorySelector(debouncedInput)

    React.useEffect(() => {
        if (value !== input) {
            setInput(value)
        }
    }, [value, input, setInput])

    React.useEffect(() => {
        if (input === ".") {
            setInputRaw("")
        }
    }, [input])

    const onSelectRef = React.useRef(onSelect)
    React.useEffect(() => {
        onSelectRef.current = onSelect
    })

    const updateEffectFirst = React.useRef(true)
    React.useEffect(() => {
        if (updateEffectFirst.current) {
            updateEffectFirst.current = false
            return
        }
        const trimmedValue = debouncedInput.trim()
        onSelectRef.current(trimmedValue)
    }, [debouncedInput])

    const handleExplorerClick = React.useCallback(async () => {
        // En Desktop (Tauri) el servidor corre en la misma máquina:
        // abrir el diálogo nativo del SO en vez del modal web.
        if (__isDesktop__) {
            setIsNativeOpening(true)
            try {
                const { open } = await import("@tauri-apps/plugin-dialog")
                const selected = await open({
                    directory: true,
                    multiple: false,
                    defaultPath: input || undefined,
                    title: "Seleccionar una carpeta",
                })
                if (typeof selected === "string" && selected) {
                    setInput(selected)
                }
                return
            } catch {
                // Sin plugin nativo (permisos/capability): caer al modal del servidor.
            } finally {
                setIsNativeOpening(false)
            }
        }
        selectorState.on()
    }, [input, setInput, selectorState])

    const handleUseFolder = React.useCallback(() => {
        onSelectRef.current(input.trim())
        selectorState.off()
    }, [input, selectorState])

    const canGoBack = !!data?.basePath?.length && data.basePath.length > 1
    const isValid = !!data?.exists

    return (
        <>
            <div className="space-y-1.5">
                {label && (
                    <div className="flex items-center justify-between gap-1 text-xs font-semibold text-zinc-300">
                        <span>{label}</span>
                    </div>
                )}

                <div className={cn(
                    "group flex items-center gap-1.5 rounded-full bg-zinc-950/40 border border-white/20 border-t-white/40 border-b-white/10",
                    "pl-4 pr-1.5 py-1.5 shadow-glass-highlight-sm",
                    "transition-all duration-200 hover:border-white/30 hover:bg-white/[0.04]",
                    "focus-within:border-white/35 focus-within:bg-white/[0.06] focus-within:shadow-[shadow:var(--glass-highlight-md),0_0_16px_rgba(255,255,255,0.1)]"
                )}>
                    <IconStatusFolder className="w-4 h-4 shrink-0 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" />
                    <div className="flex-1 min-w-0">
                        <TextInput
                            {...rest}
                            label={undefined}
                            value={input}
                            className="h-9 border-0 bg-transparent px-0 font-mono text-xs text-white shadow-none placeholder:text-zinc-600 placeholder:font-sans focus-visible:border-0"
                            inputContainerClass="flex-1 min-w-0"
                            rightIcon={
                                <div className="flex items-center pr-1">
                                    {isLoading ? (
                                        <IconUiSpinner className="w-4 h-4 animate-spin text-zinc-500" />
                                    ) : data?.exists ? (
                                        <IconUiCheck className="w-4 h-4 text-emerald-400" />
                                    ) : shouldExist && input.length > 0 ? (
                                        <IconUiClose className="w-4 h-4 text-red-400" />
                                    ) : null}
                                </div>
                            }
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                setInput(e.target.value ?? "")
                            }}
                            ref={ref}
                        />
                    </div>

                    <span className="w-px h-5 bg-white/10 shrink-0" aria-hidden="true" />

                    <IconButton
                        type="button"
                        size="md"
                        intent="gray-glass"
                        icon={isNativeOpening
                            ? <IconUiSpinner className="w-4 h-4 animate-spin" />
                            : <IconStatusFolderOpen className="w-4 h-4" />}
                        title={__isDesktop__ ? "Explorar carpetas (ventana del sistema)" : "Explorar carpetas en el servidor"}
                        aria-label={__isDesktop__ ? "Abrir explorador del sistema" : "Abrir explorador del servidor"}
                        className="h-9 w-9 md:h-9 md:w-9 shrink-0 rounded-full border-white/10 bg-white/[0.06] text-zinc-300 hover:bg-white hover:text-zinc-950 hover:border-white active:scale-95"
                        onClick={handleExplorerClick}
                        disabled={isNativeOpening}
                    />

                    {trailingAction}
                </div>
            </div>
            {/* Explorador del servidor (solo web remota: en Desktop se usa el diálogo nativo) */}
            <Modal
                open={selectorState.active}
                onOpenChange={selectorState.set}
                title="Seleccionar una carpeta"
                description="Explora el sistema de archivos del servidor y confirma con «Usar esta carpeta»."
                contentClass="mt-4 space-y-3 max-w-2xl"
                footer={
                    <div className="flex items-center justify-end gap-2 w-full">
                        <Button
                            type="button"
                            size="sm"
                            intent="gray-glass"
                            onClick={selectorState.off}
                            className="active:scale-95"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            intent="brand-primary"
                            leftIcon={<IconUiCheck className="w-3.5 h-3.5" />}
                            onClick={handleUseFolder}
                            disabled={!isValid}
                            className="active:scale-95"
                        >
                            Usar esta carpeta
                        </Button>
                    </div>
                }
            >
                <div className="flex gap-2 items-center">
                    <IconButton
                        onClick={() => data?.basePath && setInput(data?.basePath)}
                        intent="gray-basic"
                        size="sm"
                        icon={<IconNavigationChevronLeft />}
                        aria-label="Subir un nivel"
                        title="Subir un nivel"
                        disabled={!canGoBack}
                    />
                    <TextInput
                        leftIcon={<IconStatusFolder />}
                        value={input}
                        placeholder='Ej. D:\Media\Movies o /media/peliculas'
                        rightIcon={isLoading ? null : (data?.exists ?
                            <IconUiCheck className="text-emerald-400" /> : shouldExist ?
                                <IconUiClose className="text-red-400" /> : null)}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setInput(e.target.value ?? "")
                        }}
                    />
                </div>

                {(!data?.exists && data?.suggestions && data.suggestions.length > 0) && (
                    <div className="w-full flex flex-none flex-nowrap overflow-x-auto no-scrollbar gap-2 items-center">
                        <span className="flex-none text-2xs font-semibold text-on-surface-variant/70">Sugerencias:</span>
                        {data.suggestions.map(folder => (
                            <button
                                key={folder.Path}
                                type="button"
                                className="py-1.5 flex items-center gap-2 text-xs px-3 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/25 transition-all flex-none cursor-pointer active:scale-95 min-h-[32px]"
                                onClick={() => setInput(folder.Path)}
                            >
                                <IconStatusFolder className="w-3.5 h-3.5 text-on-surface-variant" />
                                <span className="break-normal font-medium text-on-surface-variant">{folder.Name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {isLoading ? (
                    <div className="h-40 rounded-2xl border border-white/10 bg-white/[0.02] flex items-center justify-center gap-2 text-xs text-on-surface-variant/70">
                        <IconUiSpinner className="w-4 h-4 animate-spin" />
                        <span>Explorando…</span>
                    </div>
                ) : (data && !!data?.Directories?.length) ? (
                    <ScrollArea className="h-60 rounded-2xl border border-white/10 bg-white/[0.02]">
                        {data.Directories.map(folder => (
                            <button
                                key={folder.Path}
                                type="button"
                                className="w-full flex items-center gap-2.5 py-2 px-3 min-h-[44px] cursor-pointer hover:bg-white/[0.06] transition-colors text-left active:scale-[0.99]"
                                onClick={() => setInput(folder.Path)}
                                title={folder.Path}
                            >
                                <IconStatusFolder className="w-4 h-4 text-brand-accent shrink-0" />
                                <span className="flex-1 min-w-0">
                                    <span className="block truncate text-xs font-semibold text-on-surface">{folder.Name}</span>
                                    <span className="block truncate text-3xs font-mono text-on-surface-variant/50">{folder.Path}</span>
                                </span>
                                <IconNavigationChevronRight className="w-3.5 h-3.5 text-on-surface-variant/40 shrink-0" />
                            </button>
                        ))}
                    </ScrollArea>
                ) : debouncedInput.length > 0 ? (
                    <div className="p-4 rounded-2xl border border-dashed border-white/10 text-center">
                        <p className="text-2xs text-on-surface-variant/60 font-medium">
                            {data?.exists
                                ? "Carpeta vacía: no contiene subcarpetas."
                                : "Sin resultados: revisa la ruta o sube un nivel."}
                        </p>
                    </div>
                ) : (
                    <div className="p-4 rounded-2xl border border-dashed border-white/10 text-center">
                        <p className="text-2xs text-on-surface-variant/60 font-medium">
                            Escribe una ruta del servidor para empezar a explorar.
                        </p>
                    </div>
                )}

                {input.length > 0 && (
                    <p className={`text-2xs font-mono truncate px-1 ${isValid ? "text-emerald-400/90" : "text-red-400/90"}`}>
                        {isValid ? `✓ ${input}` : `✗ La ruta no existe en el servidor`}
                    </p>
                )}
            </Modal>
        </>
    )

}))
