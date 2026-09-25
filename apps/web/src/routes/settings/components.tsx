import React from "react"
import { m, AnimatePresence } from "framer-motion"
import * as SelectPrimitive from "@radix-ui/react-select"
import { cn } from "@/components/ui/core/styling"
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
                    className="text-4xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 shrink-0"
                >
                    Requiere Guardar
                </m.span>
            )}
        </AnimatePresence>
    )
}

/** Suscripción por campo a dirtyFields: evita re-render global de isDirty. */
export function useFieldDirty<T extends FieldValues>(control: Control<T>, name: string): boolean {
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
  variant?: 'default' | 'success' | 'warning' | 'danger'
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

export interface OsToggleProps {
    label: string
    description?: string
    checked: boolean
    onChange: (value: boolean) => void
    disabled?: boolean
    icon?: React.ElementType
    className?: string
    variant?: 'default' | 'success' | 'warning' | 'danger'
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

    const handleToggle = () => {
        if (!disabled) {
            onChange(!checked)
        }
    }

    return (
        <div
            role="switch"
            aria-checked={checked}
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
                "flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 min-h-[44px] transition-[background-color,transform] duration-fast ease-smooth-out gap-4 select-none group outline-none",
                "focus-visible:ring-2 focus-visible:ring-brand-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950",
                disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.05] active:scale-[0.995]",
                className
            )}
        >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                {Icon && (
                    <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/20 border-t-white/30 flex items-center justify-center text-on-surface-variant shrink-0 group-hover:border-white/30 group-hover:text-white transition-colors">
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                )}
                <div className="space-y-0.5 min-w-0 flex-1 py-0.5">
                    <p className="text-xs font-bold text-on-surface tracking-tight leading-snug group-hover:text-white transition-colors flex items-center gap-2 flex-wrap">
                        {label}
                        <DirtyPill show={dirty} />
                    </p>
                    {description && (
                        <p className="text-2xs text-on-surface-variant/70 leading-normal font-medium line-clamp-2">
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

export interface OsSelectOption {
    value: string
    label: string
    desc?: string
    badge?: string
    disabled?: boolean
}

export interface OsSelectProps {
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3 hover:bg-white/[0.04] transition-colors duration-fast ease-smooth-out">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {Icon && (
                    <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/20 border-t-white/30 flex items-center justify-center text-on-surface-variant shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                )}
                <div className="space-y-0.5 min-w-0 flex-1 py-0.5">
                    <p className="text-xs font-bold text-on-surface tracking-tight leading-snug flex items-center gap-2 flex-wrap">{label}<DirtyPill show={dirty} /></p>
                    {description && <p className="text-2xs text-on-surface-variant/70 leading-normal font-medium line-clamp-2">{description}</p>}
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
                        "group relative flex items-center justify-between gap-3 shrink-0 w-full sm:w-auto sm:min-w-[264px] sm:max-w-[320px]",
                        "rounded-full bg-surface-container-lowest/60 border border-white/20 border-t-white/40 border-b-white/10",
                        "pl-4 pr-1.5 py-1.5 text-left outline-none select-none cursor-pointer",
                        "shadow-glass-highlight-sm",
                        "transition-[border-color,background-color,box-shadow,transform] duration-fast ease-smooth-out hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.98]",
                        "focus-visible:ring-2 focus-visible:ring-white/40",
                        "data-[state=open]:border-white/35 data-[state=open]:bg-white/[0.07] data-[state=open]:shadow-[shadow:var(--glass-highlight-lg),0_0_16px_rgba(255,255,255,0.12)]",
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
                                selected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-outline/60"
                            )}
                        />
                        <span className="block truncate text-xs font-semibold text-white min-w-0">
                            {selected?.label ?? <span className="text-on-surface-variant/60 font-medium">{placeholder}</span>}
                        </span>
                        <span className="hidden">
                            <SelectPrimitive.Value placeholder={placeholder} />
                        </span>
                    </span>
                    <m.span
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={chevronSpring}
                        className={cn(
                            "w-6 h-6 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-on-surface-variant shrink-0",
                            "transition-[background-color,color,border-color] duration-fast ease-smooth-out group-hover:bg-white/[0.12] group-hover:text-white group-data-[state=open]:bg-white group-data-[state=open]:text-black group-data-[state=open]:border-white"
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
                            "rounded-2xl border border-white/15 border-t-white/35 border-b-white/10",
                            "bg-surface-container-lowest/90 backdrop-blur-overlay-2xl backdrop-saturate-[190%]",
                            "shadow-[shadow:var(--glass-highlight-md),0_12px_36px_-6px_rgba(0,0,0,0.75)]",
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
                                            "transition-[background-color,color,transform] duration-fast ease-smooth-out active:scale-[0.98]",
                                            "data-[highlighted]:bg-white/[0.08] data-[highlighted]:text-white",
                                            "data-[state=checked]:bg-white/[0.08]",
                                            "data-[disabled]:opacity-40 data-[disabled]:pointer-events-none",
                                            "focus-visible:ring-1 focus-visible:ring-white/30",
                                            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1",
                                            "motion-reduce:animate-none motion-reduce:transition-none"
                                        )}
                                    >
                                        <span className={cn(
                                            "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-[background-color,border-color,color,transform,box-shadow] duration-fast ease-bounce",
                                            isActive
                                                ? "bg-white border-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)] scale-100"
                                                : "border-white/25 bg-transparent text-transparent scale-90"
                                        )}>
                                            <IconUiCheck className="w-3 h-3" strokeWidth={3} />
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <span className={cn(
                                                "block truncate text-xs leading-tight",
                                                isActive ? "font-bold text-white" : "font-semibold text-on-surface-variant"
                                            )}>
                                                {opt.label}
                                            </span>
                                            {opt.desc && (
                                                <span className="block truncate text-2xs text-on-surface-variant/70 leading-tight mt-0.5">
                                                    {opt.desc}
                                                </span>
                                            )}
                                        </span>
                                        {opt.badge && (
                                            <span className={cn(
                                                "shrink-0 text-4xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                                isActive
                                                    ? "bg-white text-black border-white"
                                                    : "bg-white/[0.06] text-on-surface-variant border-white/15"
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

export interface OsInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string
    description?: string
    isSecure?: boolean
    isMono?: boolean
    icon?: React.ElementType
    error?: string
    /** Muestra pill "Requiere Guardar". Solo para controles Solo-RHF. */
    dirty?: boolean
}

export const OsInput = React.forwardRef<HTMLInputElement, OsInputProps>(({
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3 hover:bg-white/[0.04] transition-colors duration-fast ease-smooth-out min-h-[44px]">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {Icon && (
                    <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/20 border-t-white/30 flex items-center justify-center text-on-surface-variant shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                )}
                <div className="space-y-0.5 min-w-0 max-w-xl py-0.5">
                    <p className="text-xs font-bold text-on-surface tracking-tight leading-snug flex items-center gap-2 flex-wrap">{label}<DirtyPill show={dirty} /></p>
                    {description && <p className="text-2xs text-on-surface-variant/70 leading-normal font-medium line-clamp-2">{description}</p>}
                    {error && <p className="text-3xs text-red-400 font-mono tracking-tight mt-0.5 animate-fade-in">{error}</p>}
                </div>
            </div>

            <div className={cn(
                "flex items-center gap-2 bg-surface-container-lowest/60 border border-white/20 border-t-white/40 border-b-white/10 rounded-full pl-4 pr-3 py-2 w-full sm:w-64 lg:w-72 transition-[border-color,background-color,box-shadow] duration-fast ease-smooth-out relative",
                "shadow-glass-highlight-sm",
                "focus-within:border-white/35 focus-within:bg-white/[0.06] focus-within:shadow-[shadow:var(--glass-highlight-md),0_0_16px_rgba(255,255,255,0.1)] hover:border-white/30",
                error && "border-red-500/50 focus-within:border-red-500 focus-within:shadow-[inset_0_1px_1px_0_rgba(239,68,68,0.2),0_0_16px_rgba(239,68,68,0.2)] animate-error-shake",
                className
            )}>
                <input
                    ref={ref}
                    type={isSecure ? (showSecure ? "text" : "password") : type}
                    placeholder={placeholder}
                    className={cn(
                        "flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant/40 text-xs focus:outline-none",
                        isSecure && "pr-6",
                        isMono && "font-mono text-2xs"
                    )}
                    {...props}
                />

                {isSecure && (
                    <button
                        type="button"
                        onClick={() => setShowSecure(!showSecure)}
                        aria-label={showSecure ? "Ocultar contenido" : "Mostrar contenido"}
                        className="absolute right-3 text-on-surface-variant/70 hover:text-on-surface transition-[color,transform,background-color] duration-fast ease-smooth-out p-1 active:scale-90 rounded-full hover:bg-white/10"
                    >
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
                    </button>
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
            exit={{ opacity: 0, y: -8 }}
            transition={rowSpring}
            className={cn(
            "flex items-center justify-between gap-2 bg-white/[0.03] border rounded-xl px-3.5 py-2 group/path transition-[border-color,background-color] duration-fast ease-smooth-out",
            missing ? "border-amber-400/30 hover:border-amber-400/50" : "border-white/10 hover:border-white/20",
        )}>
            <span className="text-xs text-on-surface-variant font-mono truncate" title={dir}>{displayPath}</span>
            <div className="flex items-center gap-1.5 shrink-0">
                {missing && (
                    <span
                        className="flex items-center gap-1 text-3xs font-semibold text-amber-300"
                        title="La carpeta no existe o no está accesible. Revisá que el disco esté conectado."
                    >
                        <IconUiAlertTriangle className="w-3 h-3" aria-hidden="true" />
                        No encontrada
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => onRemove(dir)}
                    className="text-on-surface-variant/70 hover:text-red-400 transition-[color,background-color,transform] duration-fast ease-smooth-out p-1 rounded-lg hover:bg-red-500/10 active:scale-90"
                    title="Eliminar ruta"
                    aria-label={`Eliminar ruta ${dir}`}
                >
                    <IconUiDelete className="w-3.5 h-3.5" />
                </button>
            </div>
        </m.div>
    )
}

export interface PathListProps {
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
                        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider truncate">{label}</h4>
                    </div>
                    <span key={directories.length} className="text-3xs font-mono px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant border border-white/10 shrink-0 tabular-nums animate-number-pop-in">
                        {directories.length} {directories.length === 1 ? "ruta" : "rutas"}
                    </span>
                </div>

                <AnimatePresence initial={false} mode="popLayout">
                {directories.length > 0 ? (
                    <m.div key="list" layout className="space-y-2">
                        {directories.map((dir) => (
                            <PathRow key={dir} dir={dir} showFullPath={showFullPath} onRemove={onRemove} />
                        ))}
                    </m.div>
                ) : (
                    <m.div
                        key="empty"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ type: "tween", duration: 0.15 }}
                        className="p-3 rounded-xl border border-dashed border-white/10 text-center"
                    >
                        <p className="text-2xs text-on-surface-variant/50 font-medium animate-text-swap-in">
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
                    trailingAction={
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={!selectedPath.trim()}
                            title={selectedPath.trim() ? `Agregar ${selectedPath.trim()}` : "Escribe o explora una carpeta"}
                            className="h-9 pl-3.5 pr-4 rounded-full text-xs font-bold shrink-0 flex items-center gap-1.5 transition-[background-color,color,box-shadow,transform,filter] duration-fast ease-smooth-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 bg-brand-accent text-white shadow-brand-primary hover:brightness-110 disabled:bg-white/[0.07] disabled:text-on-surface-variant/50 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:brightness-100"
                        >
                            <IconUiPlus className="w-3.5 h-3.5" />
                            <span>Agregar</span>
                        </button>
                    }
                />
            </div>
        </div>
    )
}
