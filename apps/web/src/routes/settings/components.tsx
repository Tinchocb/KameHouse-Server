import React from "react"
import { m, AnimatePresence } from "framer-motion"
import * as SelectPrimitive from "@radix-ui/react-select"
import { cn } from "@/components/ui/core/styling"
import { Button, IconButton } from "@/components/ui/button"
import { IconNavigationChevronDown, IconUiEyeOff, IconUiEye, IconUiDelete, IconUiPlus, IconUiCheck, IconUiAlertTriangle } from "@/components/ui/icons";
import { DirectorySelector } from "@/components/shared/directory-selector"
import { useDirectorySelector } from "@/api/hooks/directory_selector.hooks"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"
import { type Control, type FieldValues, useFormState } from "react-hook-form"
import { get } from "react-hook-form"

// ─── DirtyBadge ─────────────────────────────────────────────────────────────────
// Pill "Requiere Guardar" para controles Solo-RHF (sin efecto hasta Guardar).
// Los controles dual-write (efecto inmediato) NO deben usarlo.

export function DirtyPill({ show }: { show?: boolean }) {
    const popSpring = useSpringPreset("press")
    return (
        <AnimatePresence initial={false}>
            {show && (
                <m.span
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={popSpring}
                    className="text-2xs font-bold px-2 py-0.5 rounded-full bg-status-warning/10 text-status-warning border border-status-warning/25 shrink-0"
                >
                    Requiere guardar
                </m.span>
            )}
        </AnimatePresence>
    )
}

/** Suscripción por campo a dirtyFields: evita re-render global de isDirty. */
function useFieldDirty<T extends FieldValues>(control: Control<T>, name: string): boolean {
    const { dirtyFields } = useFormState({ control })
    return !!get(dirtyFields, name)
}

// ─── Modern Physical Toggle Component ─────────────────────────────────────────

import { SpringSwitch } from "@/components/ui/switch/spring-switch"

interface ToggleProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  onChange?: (checked: boolean) => void
  className?: string
  variant?: 'default'
  disabled?: boolean
  size?: 'sm' | 'md'
  ariaHidden?: boolean
  isPressingExternal?: boolean
}

function Toggle({ 
  checked = false, 
  onCheckedChange, 
  onChange,
  className,
  variant = 'default',
  disabled = false,
  size = 'md',
  ariaHidden,
  isPressingExternal,
}: ToggleProps) {
  return (
    <SpringSwitch
      checked={checked}
      onChange={onChange}
      onCheckedChange={onCheckedChange}
      className={className}
      variant={variant}
      disabled={disabled}
      size={size}
      ariaHidden={ariaHidden}
      isPressingExternal={isPressingExternal}
    />
  )
}

// ─── OsToggle ─────────────────────────────────────────────────────────────────

interface OsToggleProps {
    label: string
    description?: string
    checked: boolean
    onChange: (value: boolean) => void
    disabled?: boolean
    icon?: React.ElementType
    className?: string
    variant?: 'default'
    /** Muestra pill "Requiere Guardar". Solo para controles Solo-RHF. */
    dirty?: boolean
}

export const OsToggle = React.memo(function OsToggle({
    label,
    description,
    checked,
    onChange,
    disabled = false,
    icon: Icon,
    className,
    variant = 'default',
    dirty = false,
}: OsToggleProps) {
    const [isRowPressing, setIsRowPressing] = React.useState(false)
    // El switch se nombra con su etiqueta: la ayuda va en aria-describedby y la pastilla
    // "Requiere guardar" no forma parte del nombre.
    const labelId = React.useId()
    const descriptionId = React.useId()

    const handleToggle = () => {
        if (!disabled) {
            onChange(!checked)
        }
    }

    return (
        <div
            role="switch"
            aria-checked={checked}
            aria-disabled={disabled || undefined}
            aria-labelledby={labelId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                    e.preventDefault()
                    handleToggle()
                }
            }}
            onClick={handleToggle}
            onPointerDown={() => !disabled && setIsRowPressing(true)}
            onPointerUp={() => setIsRowPressing(false)}
            onPointerLeave={() => setIsRowPressing(false)}
            className={cn(
                // El resaltado vive en un ::before inset y redondeado: el divisor de la fila
                // (border-top de .sectionbar-divide) queda recto y la banda no toca los bordes.
                "relative isolate flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 min-h-[44px] gap-4 select-none group outline-none",
                "before:content-[''] before:absolute before:inset-x-1 before:inset-y-1 before:-z-10 before:rounded-xl before:bg-[var(--neutral-elev-2)] before:opacity-0",
                "before:transition-[opacity,background-color] before:duration-fast before:ease-out-strong motion-reduce:before:transition-none",
                "focus-visible:before:opacity-100 focus-visible:before:ring-2 focus-visible:before:ring-inset focus-visible:before:ring-brand-accent",
                disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "cursor-pointer [@media(hover:hover)_and_(pointer:fine)]:hover:before:opacity-100 active:before:opacity-100 active:before:bg-[var(--neutral-elev-3)]",
                className
            )}
        >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                {Icon && (
                    <div className="w-7 h-7 rounded-lg bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-center text-on-surface-variant shrink-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-on-surface transition-colors duration-fast ease-smooth-out">
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                )}
                <div className="space-y-0.5 min-w-0 flex-1 py-0.5">
                    <p className="text-xs font-bold text-on-surface tracking-tight leading-snug [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-label-1 transition-colors duration-fast ease-smooth-out flex items-center gap-2 flex-wrap">
                        <span id={labelId}>{label}</span>
                        <DirtyPill show={dirty} />
                    </p>
                    {description && (
                        <p id={descriptionId} className="text-2xs text-label-2 leading-normal font-medium line-clamp-2">
                            {description}
                        </p>
                    )}
                </div>
            </div>

            <Toggle
                checked={checked}
                onCheckedChange={onChange}
                disabled={disabled}
                variant={variant}
                ariaHidden={true}
                isPressingExternal={isRowPressing}
                className="pointer-events-none shrink-0"
            />
        </div>
    )
})

// ─── OsSelect ─────────────────────────────────────────────────────────────────
// Custom glass dropdown (Radix) — reemplaza el <select> nativo cuyo popup
// lo pinta el SO (fondo negro plano, sin radius/shadow, se recorta).

interface OsSelectOption {
    value: string
    label: string
    desc?: string
    badge?: string
    disabled?: boolean
}

interface OsSelectProps {
    label: string
    description?: string
    options: OsSelectOption[]
    value?: string
    defaultValue?: string
    onChange?: (value: string) => void
    onValueChange?: (value: string) => void
    icon?: React.ElementType
    placeholder?: string
    disabled?: boolean
    name?: string
    className?: string
    /** Muestra pill "Requiere Guardar". Solo para controles Solo-RHF. */
    dirty?: boolean
}

export const OsSelect = React.memo(function OsSelect({
    label,
    description,
    options,
    value,
    defaultValue,
    onChange,
    onValueChange,
    icon: Icon,
    placeholder = "Seleccionar…",
    disabled = false,
    name,
    className,
    dirty = false,
}: OsSelectProps) {
    const [open, setOpen] = React.useState(false)
    const selected = options.find((o) => o.value === (value ?? defaultValue))
    const chevronSpring = useSpringPreset("tabIndicator")
    const dotSpring = useSpringPreset("press")

    const handleChange = (v: string) => {
        onValueChange?.(v)
        onChange?.(v)
    }

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {Icon && (
                    <div className="w-7 h-7 rounded-lg bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-center text-on-surface-variant shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                )}
                <div className="space-y-0.5 min-w-0 flex-1 py-0.5">
                    <p className="text-xs font-bold text-on-surface tracking-tight leading-snug flex items-center gap-2 flex-wrap">{label}<DirtyPill show={dirty} /></p>
                    {description && <p className="text-2xs text-label-2 leading-normal font-medium line-clamp-2">{description}</p>}
                </div>
            </div>

            <SelectPrimitive.Root
                value={value}
                defaultValue={defaultValue}
                onValueChange={handleChange}
                onOpenChange={setOpen}
                disabled={disabled}
                name={name}
            >
                <SelectPrimitive.Trigger
                    aria-label={label}
                    className={cn(
                        "group relative flex items-center justify-between gap-3 shrink-0 w-full sm:w-auto sm:min-w-[264px] sm:max-w-[320px] min-h-[44px]",
                        "rounded-full bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)]",
                        "pl-4 pr-1.5 py-1.5 text-left outline-none select-none cursor-pointer",
                        "transition-[border-color,background-color,transform] duration-fast ease-smooth-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] active:scale-95",
                        "focus-visible:ring-2 focus-visible:ring-brand-accent",
                        "data-[state=open]:bg-[var(--neutral-elev-3)]",
                        "data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed",
                        className
                    )}
                >
                    <span className="flex items-center gap-2 min-w-0 flex-1">
                        <m.span
                            animate={{ scale: open ? 1.35 : 1 }}
                            transition={dotSpring}
                            className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                selected ? "bg-status-success shadow-[shadow:var(--shadow-glow-status-success)]" : "bg-outline/60"
                            )}
                        />
                        <span className="block truncate text-xs font-semibold text-label-1 min-w-0">
                            {selected?.label ?? <span className="text-label-3 font-medium">{placeholder}</span>}
                        </span>
                        <span className="hidden">
                            <SelectPrimitive.Value placeholder={placeholder} />
                        </span>
                    </span>
                    <m.span
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={chevronSpring}
                        className={cn(
                            "w-6 h-6 rounded-full bg-[var(--neutral-elev-3)] flex items-center justify-center text-on-surface-variant shrink-0",
                            "transition-[background-color,color,border-color] duration-fast ease-smooth-out group-hover:text-label-1 group-data-[state=open]:bg-[var(--selected-bg)] group-data-[state=open]:text-[var(--selected-fg)] group-data-[state=open]:border-[var(--selected-bg)]"
                        )}
                    >
                        <IconNavigationChevronDown className="w-3.5 h-3.5" />
                    </m.span>
                </SelectPrimitive.Trigger>

                <SelectPrimitive.Portal>
                    <SelectPrimitive.Content
                        position="popper"
                        sideOffset={8}
                        align="end"
                        style={{ transformOrigin: "var(--radix-select-content-transform-origin)" }}
                        className={cn(
                            "z-dropdown min-w-[var(--radix-select-trigger-width)] max-w-[min(92vw,360px)] overflow-hidden",
                            // Mismos bordes que .sectionbar vía tokens: siguen a Clásico y Flat.
                            "rounded-2xl border border-[var(--sectionbar-border)] border-t-[var(--sectionbar-border-top)] border-b-[var(--sectionbar-border-bottom)]",
                            "bg-surface-container-lowest/90 backdrop-blur-overlay-md backdrop-saturate-[180%]",
                            "shadow-elevation-3",
                            "p-1.5 origin-[var(--radix-select-content-transform-origin)]",
                            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2 data-[state=open]:duration-base data-[state=open]:ease-smooth-out",
                            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-top-1 data-[state=closed]:duration-fast data-[state=closed]:ease-standard",
                            "motion-reduce:animate-none"
                        )}
                    >
                        <SelectPrimitive.Viewport className="p-0 max-h-[280px] overflow-y-auto no-scrollbar">
                            {options.map((opt, idx) => {
                                const isActive = opt.value === (value ?? defaultValue)
                                return (
                                    <SelectPrimitive.Item
                                        key={opt.value}
                                        value={opt.value}
                                        disabled={opt.disabled}
                                        style={{ animationDelay: `${Math.min(idx, 6) * 40}ms` }}
                                        className={cn(
                                            "relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 outline-none cursor-pointer select-none min-h-[38px]",
                                            "transition-[background-color,color,transform] duration-fast ease-smooth-out active:scale-95",
                                            "data-[highlighted]:bg-[var(--neutral-elev-3)] data-[highlighted]:text-label-1",
                                            "data-[state=checked]:bg-[var(--neutral-elev-3)]",
                                            "data-[disabled]:opacity-40 data-[disabled]:pointer-events-none",
                                            "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent",
                                            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1",
                                            "motion-reduce:animate-none motion-reduce:transition-none"
                                        )}
                                    >
                                        <span className={cn(
                                            "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-[background-color,border-color,color,transform,box-shadow] duration-fast ease-bounce-spring",
                                            isActive
                                                ? "bg-[var(--selected-bg)] text-[var(--selected-fg)] border-[var(--selected-bg)] scale-100"
                                                : "border-[var(--neutral-separator)] bg-transparent text-transparent scale-90"
                                        )}>
                                            <IconUiCheck className="w-3 h-3" strokeWidth={3} />
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <span className={cn(
                                                "block truncate text-xs leading-tight",
                                                isActive ? "font-bold text-label-1" : "font-semibold text-label-2"
                                            )}>
                                                {/* ItemText registra la <option> del <select> nativo que Radix
                                                    usa dentro de un <form>. Sin él, el nativo no tenía la opción,
                                                    quedaba en "" y esa "elección" vacía pisaba la real: ningún
                                                    selector de Ajustes cambiaba de valor. */}
                                                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                                            </span>
                                            {opt.desc && (
                                                <span className="block truncate text-2xs text-label-2 leading-tight mt-0.5">
                                                    {opt.desc}
                                                </span>
                                            )}
                                        </span>
                                        {opt.badge && (
                                            <span className={cn(
                                                "shrink-0 text-2xs font-bold px-2 py-0.5 rounded-full border",
                                                isActive
                                                    ? "bg-[var(--selected-bg)] text-[var(--selected-fg)] border-[var(--selected-bg)]"
                                                    : "bg-[var(--neutral-elev-3)] text-label-2 border-[var(--neutral-separator)]"
                                            )}>
                                                {opt.badge}
                                            </span>
                                        )}
                                    </SelectPrimitive.Item>
                                )
                            })}
                        </SelectPrimitive.Viewport>
                    </SelectPrimitive.Content>
                </SelectPrimitive.Portal>
            </SelectPrimitive.Root>
        </div>
    )
})

// ─── OsInput ──────────────────────────────────────────────────────────────────

interface OsInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string
    description?: string
    isSecure?: boolean
    isMono?: boolean
    icon?: React.ElementType
    error?: string
    /** Muestra pill "Requiere Guardar". Solo para controles Solo-RHF. */
    dirty?: boolean
}

const OsInput = React.forwardRef<HTMLInputElement, OsInputProps>(({
    label,
    description,
    placeholder,
    isSecure = false,
    isMono = false,
    type = "text",
    icon: Icon,
    error,
    dirty = false,
    className,
    ...props
}, ref) => {
    const [showSecure, setShowSecure] = React.useState(false)
    const iconSwapSpring = useSpringPreset("press")

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3 min-h-[44px]">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {Icon && (
                    <div className="w-7 h-7 rounded-lg bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] flex items-center justify-center text-on-surface-variant shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                )}
                <div className="space-y-0.5 min-w-0 max-w-xl py-0.5">
                    <p className="text-xs font-bold text-on-surface tracking-tight leading-snug flex items-center gap-2 flex-wrap">{label}<DirtyPill show={dirty} /></p>
                    {description && <p className="text-2xs text-label-2 leading-normal font-medium line-clamp-2">{description}</p>}
                    {error && <p className="text-2xs text-status-error mt-0.5 animate-fade-in">{error}</p>}
                </div>
            </div>

            <div className={cn(
                "flex items-center gap-2 bg-[var(--neutral-elev-2)] border border-[var(--neutral-separator)] rounded-full min-h-11 pl-4 pr-3 py-2 w-full sm:w-64 lg:w-72 transition-[border-color,background-color] duration-fast ease-smooth-out relative",
                "has-[input:focus-visible]:outline has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:[outline-color:hsl(var(--focus-ring)/0.9)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]",
                error && "border-status-error/60 animate-error-shake",
                className
            )}>
                <input
                    ref={ref}
                    data-field-embedded
                    type={isSecure ? (showSecure ? "text" : "password") : type}
                    placeholder={placeholder}
                    // La etiqueta visible es un <p> suelto: sin esto el campo no tenía nombre accesible.
                    aria-label={typeof label === "string" ? label : undefined}
                    className={cn(
                        "min-w-0 flex-1 border-0 p-0 bg-transparent text-on-surface placeholder:text-label-3 text-base md:text-xs focus:outline-none",
                        isSecure && "pr-6",
                        isMono && "font-mono md:text-2xs"
                    )}
                    {...props}
                />

                {isSecure && (
                    <IconButton
                        intent="ghost"
                        size="xs"
                        onClick={() => setShowSecure(!showSecure)}
                        aria-label={showSecure ? "Ocultar contenido" : "Mostrar contenido"}
                        className="absolute right-1.5 text-label-2 hover:text-label-1"
                        icon={
                            <AnimatePresence mode="wait" initial={false}>
                                <m.span
                                    key={showSecure ? "hide" : "show"}
                                    initial={{ opacity: 0, scale: 0.6 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.6 }}
                                    transition={iconSwapSpring}
                                    className="flex"
                                >
                                    {showSecure ? <IconUiEyeOff className="w-3.5 h-3.5" /> : <IconUiEye className="w-3.5 h-3.5" />}
                                </m.span>
                            </AnimatePresence>
                        }
                    />
                )}
            </div>
        </div>
    )
})

OsInput.displayName = "OsInput"

// ─── Dirty wrappers ─────────────────────────────────────────────────────────────
// Conectan un control Solo-RHF al pill "Requiere Guardar" vía dirtyFields.
// No usar en controles dual-write (ya tienen efecto inmediato).

export function DirtyOsToggle<T extends FieldValues>({ control, name, ...props }: OsToggleProps & { control: Control<T>; name: string }) {
    const dirty = useFieldDirty(control, name)
    return <OsToggle {...props} dirty={dirty} />
}

export function DirtyOsSelect<T extends FieldValues>({ control, name, ...props }: OsSelectProps & { control: Control<T>; name: string }) {
    const dirty = useFieldDirty(control, name)
    return <OsSelect {...props} dirty={dirty} />
}

export function DirtyOsInput<T extends FieldValues>({ control, name, ...props }: OsInputProps & { control: Control<T>; name: string }) {
    const dirty = useFieldDirty(control, name)
    return <OsInput {...props} dirty={dirty} />
}

// ─── PathList ─────────────────────────────────────────────────────────────────

/** Fila de una carpeta de biblioteca; avisa si la carpeta ya no existe en disco
 *  (unidad desconectada o movida), la causa típica de "archivo no encontrado". */
function PathRow({ dir, showFullPath, onRemove }: { dir: string, showFullPath: boolean, onRemove: (path: string) => void }) {
    const { data } = useDirectorySelector(dir)
    const rowSpring = useSpringPreset("entrance")
    const missing = data?.exists === false
    const displayPath = showFullPath ? dir : (dir.replace(/[\\/]+$/, "").split(/[/\\]/).filter(Boolean).pop() || dir)

    return (
        <m.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            // Salida más corta que la entrada: --duration-quick y --ease-out.
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] } }}
            transition={rowSpring}
            className={cn(
            "flex items-center justify-between gap-2 bg-[var(--neutral-elev-2)] border rounded-xl px-3.5 py-2 group/path transition-[border-color,background-color] duration-fast ease-smooth-out",
            missing ? "border-status-warning/30 hover:border-status-warning/50" : "border-[var(--neutral-separator)] hover:bg-[var(--neutral-elev-3)]",
        )}>
            <span className="text-xs text-on-surface-variant font-mono truncate" title={dir}>{displayPath}</span>
            <div className="flex items-center gap-1.5 shrink-0">
                {missing && (
                    <span
                        className="flex items-center gap-1 text-3xs font-semibold text-status-warning"
                        title="La carpeta no existe o no está accesible. Revisa que el disco esté conectado."
                    >
                        <IconUiAlertTriangle className="w-3 h-3" aria-hidden="true" />
                        No encontrada
                    </span>
                )}
                <IconButton
                    intent="ghost"
                    size="md"
                    onClick={() => onRemove(dir)}
                    className="text-label-2 hover:text-status-error hover:bg-status-error/10"
                    title="Quitar carpeta"
                    aria-label={`Quitar carpeta ${dir}`}
                    icon={<IconUiDelete className="w-3.5 h-3.5" />}
                />
            </div>
        </m.div>
    )
}

interface PathListProps {
    label: string
    directories: string[]
    onAdd: (path: string) => void
    onRemove: (path: string) => void
    placeholder?: string
    icon?: React.ElementType
    className?: string
    showFullPath?: boolean
}

export function PathList({ label, directories, onAdd, onRemove, placeholder, icon: Icon, className, showFullPath = true }: PathListProps) {
    const [selectedPath, setSelectedPath] = React.useState("")

    const handleAdd = () => {
        const path = selectedPath.trim()
        if (path) {
            onAdd(path)
            setSelectedPath("")
        }
    }

    const handleDirectorySelect = (path: string) => {
        setSelectedPath(path)
    }

    return (
        <div className={cn("p-5 space-y-4 h-full flex flex-col justify-between", className)}>
            <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2 min-h-[26px]">
                    <div className="flex items-center gap-2 min-w-0">
                        {Icon && <Icon className="w-4 h-4 text-brand-accent shrink-0" />}
                        <h3 className="text-xs font-bold text-on-surface truncate">{label}</h3>
                    </div>
                    <span key={directories.length} className="text-3xs font-mono px-2 py-0.5 rounded-full bg-[var(--neutral-elev-2)] text-label-2 border border-[var(--neutral-separator)] shrink-0 tabular-nums animate-number-pop-in">
                        {directories.length} {directories.length === 1 ? "carpeta" : "carpetas"}
                    </span>
                </div>

                <AnimatePresence initial={false} mode="popLayout">
                {directories.length > 0 ? (
                    <m.div key="list" layout className="space-y-2">
                        {/* Modo por defecto, no popLayout: PathRow no reenvía ref y PopChild lo
                            necesita para sacar la fila del flujo. La fila sale en su lugar y
                            `layout` reacomoda las de abajo al terminar. */}
                        <AnimatePresence initial={false}>
                            {directories.map((dir) => (
                                <PathRow key={dir} dir={dir} showFullPath={showFullPath} onRemove={onRemove} />
                            ))}
                        </AnimatePresence>
                    </m.div>
                ) : (
                    <m.div
                        key="empty"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ type: "tween", duration: 0.15 }}
                        className="p-3 rounded-xl border border-dashed border-[var(--neutral-separator)] text-center"
                    >
                        <p className="text-2xs text-label-2 font-medium animate-text-swap-in">
                            Sin carpetas añadidas
                        </p>
                    </m.div>
                )}
                </AnimatePresence>
            </div>

            <div
                className="mt-3"
            >
                <DirectorySelector
                    value={selectedPath}
                    onSelect={handleDirectorySelect}
                    shouldExist={true}
                    placeholder={placeholder}
                    label={false}
                    aria-label={`Añadir carpeta: ${label}`}
                    trailingAction={
                        <Button
                            intent="primary"
                            size="sm"
                            onClick={handleAdd}
                            disabled={!selectedPath.trim()}
                            title={selectedPath.trim() ? `Añadir ${selectedPath.trim()}` : "Escribe o elige una carpeta"}
                            leftIcon={<IconUiPlus className="w-3.5 h-3.5" />}
                            iconSpacing="0.375rem"
                            className="shrink-0"
                        >
                            Añadir
                        </Button>
                    }
                />
            </div>
        </div>
    )
}
