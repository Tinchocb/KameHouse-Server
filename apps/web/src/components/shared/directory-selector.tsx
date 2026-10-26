import { useDirectorySelector } from "@/api/hooks/directory_selector.hooks"

import { Button, IconButton } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { Modal } from "@/components/ui/modal"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TextInput, TextInputProps } from "@/components/ui/text-input"
import { useBoolean } from "@/hooks/use-disclosure"
import { normalizeSafe } from "@/lib/helpers/path"
import { __isDesktop__ } from "@/types/constants"
import React from "react"
import { IconStatusFolder, IconUiSpinner, IconUiCheck, IconUiClose, IconStatusFolderOpen, IconNavigationChevronLeft, IconNavigationChevronRight } from "@/components/ui/icons";
import { useDebounce } from "use-debounce"

type DirectorySelectorProps = {
    onSelect: (path: string) => void
    shouldExist?: boolean
    value: string
    /** Acción extra al final de la barra (ej. botón "Añadir" de PathList). */
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
        return normalizeSafe(path.replace(/[<>"]/g, ""))
    }, [])

    const [input, setInputRaw] = React.useState(() => sanitizePath(value ?? ""))
    const [debouncedInput] = useDebounce(input, 300)
    const selectorState = useBoolean(false)
    const [isNativeOpening, setIsNativeOpening] = React.useState(false)

    const setInput = React.useCallback((newInput: string) => {
        setInputRaw(sanitizePath(newInput))
    }, [sanitizePath])

    const { data, isLoading, isFetching, isPlaceholderData } = useDirectorySelector(debouncedInput)

    // Sincroniza desde la prop solo cuando la prop cambia (explorador, "Agregar"
    // que limpia el campo). Antes el efecto dependía también de `input`: con cada
    // tecla volvía a poner el valor viejo, porque onSelect avisa al padre recién
    // tras el debounce, y no se podía escribir una ruta a mano.
    const [prevValue, setPrevValue] = React.useState(value)
    if (value !== prevValue) {
        setPrevValue(value)
        setInputRaw(sanitizePath(value ?? ""))
    }

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
                    title: "Elegir una carpeta",
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
    // La validez no sale de datos viejos: durante el debounce `data` es de la ruta
    // anterior, y con placeholderData también. Si no, «Usar esta carpeta» y el ✓
    // confirmarían una ruta que todavía no se comprobó.
    const settled = debouncedInput === input && !isPlaceholderData
    const isValid = settled && !!data?.exists
    const isChecking = !settled || isLoading
    const suggestions = (!data?.exists && data?.suggestions) || []
    const hasSuggestions = suggestions.length > 0

    return (
        <>
            <div className="space-y-1.5">
                {label && (
                    <div className="flex items-center justify-between gap-1 text-xs font-semibold text-on-surface-variant">
                        <span>{label}</span>
                    </div>
                )}

                <div className={cn(
                    "group flex items-center gap-1.5 surface-content rounded-full",
                    "has-[input:focus-visible]:outline has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:[outline-color:hsl(var(--focus-ring)/0.9)]",
                    "pl-4 pr-1.5 py-1.5",
                    "transition-[background-color,border-color,box-shadow] duration-fast ease-smooth-out hover:border-white/30 hover:bg-white/[0.04]",
                    "focus-within:border-white/35 focus-within:bg-white/[0.06] focus-within:shadow-[shadow:var(--glass-highlight-md),0_0_16px_rgba(255,255,255,0.1)]"
                )}>
                    <IconStatusFolder className="w-4 h-4 shrink-0 text-label-2 group-focus-within:text-on-surface-variant transition-colors" />
                    <div className="flex-1 min-w-0">
                        <TextInput
                            {...rest}
                            label={undefined}
                            data-field-embedded
                            // La etiqueta visible es un <span> suelto: sin esto el campo
                            // no tenía nombre accesible (lectores de pantalla, TV).
                            aria-label={rest["aria-label"] ?? (typeof label === "string" ? label : undefined) ?? rest.placeholder ?? "Ruta de carpeta"}
                            value={input}
                            className="h-9 border-0 bg-transparent px-0 font-mono text-base md:text-xs text-on-surface shadow-none placeholder:text-label-3 placeholder:font-sans focus-visible:border-0"
                            inputContainerClass="flex-1 min-w-0"
                            rightIcon={
                                <div className="flex items-center pr-1">
                                    {isLoading ? (
                                        <IconUiSpinner className="w-4 h-4 animate-spin text-on-surface-variant" />
                                    ) : isValid ? (
                                        <IconUiCheck className="w-4 h-4 text-status-success" />
                                    ) : settled && shouldExist && input.length > 0 ? (
                                        <IconUiClose className="w-4 h-4 text-status-error" />
                                    ) : null}
                                </div>
                            }
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                setInput(e.target.value ?? "")
                                rest.onChange?.(e)
                            }}
                            ref={ref}
                        />
                    </div>

                    <span className="w-px h-5 bg-white/10 shrink-0" aria-hidden="true" />

                    <IconButton
                        type="button"
                        size="md"
                        intent="secondary"
                        icon={isNativeOpening
                            ? <IconUiSpinner className="w-4 h-4 animate-spin" />
                            : <IconStatusFolderOpen className="w-4 h-4" />}
                        title={__isDesktop__ ? "Explorar carpetas (ventana del sistema)" : "Explorar carpetas en el servidor"}
                        aria-label={__isDesktop__ ? "Abrir explorador del sistema" : "Abrir explorador del servidor"}
                        className="h-9 w-9 md:h-9 md:w-9 shrink-0 text-on-surface-variant active:scale-95"
                        onClick={handleExplorerClick}
                        disabled={rest.disabled || isNativeOpening}
                    />

                    {trailingAction}
                </div>
            </div>
            {/* Explorador del servidor (solo web remota: en Desktop se usa el diálogo nativo) */}
            <Modal
                open={selectorState.active}
                onOpenChange={selectorState.set}
                title="Elegir una carpeta"
                description="Explora el sistema de archivos del servidor y confirma con «Usar esta carpeta»."
                contentClass="mt-4 space-y-3 max-w-2xl"
                footer={
                    <div className="flex items-center justify-end gap-2 w-full">
                        <Button
                            type="button"
                            size="sm"
                            intent="secondary"
                            onClick={selectorState.off}
                            className="active:scale-95"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            intent="primary"
                            leftIcon={<IconUiCheck className="w-3.5 h-3.5" />}
                            onClick={handleUseFolder}
                            disabled={rest.disabled || !isValid}
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
                        intent="ghost"
                        size="sm"
                        icon={<IconNavigationChevronLeft />}
                        aria-label="Subir un nivel"
                        title="Subir un nivel"
                        disabled={!canGoBack}
                    />
                    <TextInput
                        leftIcon={<IconStatusFolder />}
                        value={input}
                        aria-label="Ruta de la carpeta"
                        placeholder='Ej. D:\Media\Series o /media/series'
                        rightIcon={isFetching ? <IconUiSpinner className="animate-spin text-on-surface-variant" /> : (isValid ?
                            <IconUiCheck className="text-status-success" /> : settled && shouldExist ?
                                <IconUiClose className="text-status-error" /> : null)}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setInput(e.target.value ?? "")
                        }}
                    />
                </div>

                {/* La fila de sugerencias reserva su alto aunque esté vacía: así el diálogo
                    (centrado por el Modal) no cambia de alto al navegar. */}
                <div
                    aria-hidden={hasSuggestions ? undefined : true}
                    className={cn(
                        "w-full min-h-8 flex flex-none flex-nowrap overflow-x-auto no-scrollbar gap-2 items-center",
                        !hasSuggestions && "invisible"
                    )}
                >
                    {hasSuggestions && (
                        <>
                            <span className="flex-none text-2xs font-semibold text-label-2">Sugerencias:</span>
                            {suggestions.map(folder => (
                                <button
                                    key={folder.Path}
                                    type="button"
                                    className="py-1.5 flex items-center gap-2 text-xs px-3 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/25 transition-[background-color,border-color,transform] duration-fast ease-out-strong flex-none cursor-pointer active:scale-95 min-h-[32px]"
                                    onClick={() => setInput(folder.Path)}
                                >
                                    <IconStatusFolder className="w-3.5 h-3.5 text-on-surface-variant" />
                                    <span className="break-normal font-medium text-on-surface-variant">{folder.Name}</span>
                                </button>
                            ))}
                        </>
                    )}
                </div>

                {/* Carga, lista y vacíos comparten h-60: el diálogo no salta entre carpetas. */}
                {isLoading ? (
                    <div className="h-60 rounded-2xl border border-white/10 bg-white/[0.02] flex items-center justify-center gap-2 text-xs text-label-2">
                        <IconUiSpinner className="w-4 h-4 animate-spin" />
                        <span>Explorando…</span>
                    </div>
                ) : (data && !!data?.Directories?.length) ? (
                    <ScrollArea
                        aria-busy={isPlaceholderData || undefined}
                        className={cn(
                            "h-60 rounded-2xl border border-white/10 bg-white/[0.02] transition-opacity duration-quick ease-out-strong",
                            isPlaceholderData && "opacity-60"
                        )}
                    >
                        {data.Directories.map(folder => (
                            <button
                                key={folder.Path}
                                type="button"
                                className="w-full flex items-center gap-2.5 py-2 px-3 min-h-[44px] cursor-pointer hover:bg-white/[0.06] transition-[color,background-color,border-color,transform] duration-fast ease-out-strong text-left active:scale-[0.99]"
                                onClick={() => setInput(folder.Path)}
                                title={folder.Path}
                            >
                                <IconStatusFolder className="w-4 h-4 text-brand-accent shrink-0" />
                                <span className="flex-1 min-w-0">
                                    <span className="block truncate text-xs font-semibold text-on-surface">{folder.Name}</span>
                                    <span className="block truncate text-3xs font-mono text-label-2">{folder.Path}</span>
                                </span>
                                <IconNavigationChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-label-3 shrink-0" />
                            </button>
                        ))}
                    </ScrollArea>
                ) : debouncedInput.length > 0 ? (
                    <div className="h-60 flex items-center justify-center p-4 rounded-2xl border border-dashed border-white/10 text-center">
                        <p className="text-2xs text-label-2 font-medium">
                            {data?.exists
                                ? "Carpeta vacía: no contiene subcarpetas."
                                : "Sin resultados: revisa la ruta o sube un nivel."}
                        </p>
                    </div>
                ) : (
                    <div className="h-60 flex items-center justify-center p-4 rounded-2xl border border-dashed border-white/10 text-center">
                        <p className="text-2xs text-label-2 font-medium">
                            Escribe una ruta del servidor para empezar a explorar.
                        </p>
                    </div>
                )}

                {input.length > 0 && (
                    <p role="status" className={cn("text-2xs truncate px-1", isChecking ? "text-label-2" : isValid ? "text-status-success" : "text-status-error")}>
                        {isChecking
                            ? "Comprobando la ruta…"
                            : isValid
                                ? <><span className="font-semibold">Ruta válida: </span><span className="font-mono">{input}</span></>
                                : "La ruta no existe en el servidor. Revisa que esté bien escrita."}
                    </p>
                )}
            </Modal>
        </>
    )

}))
