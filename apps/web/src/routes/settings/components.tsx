import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import * as SelectPrimitive from "@radix-ui/react-select"
import { cn } from "@/components/ui/core/styling"
import { IconNavigationChevronDown, IconUiEyeOff, IconUiEye, IconUiDelete, IconUiPlus, IconUiCheck } from "@/components/ui/icons";
import { DirectorySelector } from "@/components/shared/directory-selector"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"

// ─── SettingsSection ──────────────────────────────────────────────────────────

export interface SettingsSectionProps {
    id?: string
    label: string
    description?: string
    icon?: React.ElementType
    badge?: React.ReactNode
    children: React.ReactNode
    className?: string
    collapsible?: boolean
    defaultOpen?: boolean
    searchQuery?: string
}

export function SettingsSection({
    id,
    label,
    description,
    icon: Icon,
    badge,
    children,
    className,
    collapsible = false,
    defaultOpen = true,
    searchQuery,
}: SettingsSectionProps) {
    const [isOpen, setIsOpen] = React.useState(defaultOpen)
    const isSearching = !!searchQuery && searchQuery.trim().length > 0
    const collapseSpring = useSpringPreset("tabContent")

    if (!collapsible) {
        return (
            <div id={id} className={cn("space-y-3.5 scroll-mt-28", className)}>
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-3">
                        {Icon && (
                            <div className="w-8 h-8 rounded-xl bg-brand-accent/10 border border-brand-accent/25 flex items-center justify-center text-brand-accent shrink-0 shadow-[0_0_12px_hsl(var(--brand-accent)/0.15)]">
                                <Icon className="w-4 h-4" />
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-black uppercase tracking-wider text-on-surface font-mono">
                                    {label}
                                </h3>
                                {badge}
                            </div>
                            {description && (
                                <p className="text-[11px] text-on-surface-variant/70 leading-normal font-medium mt-0.5">
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                {children}
            </div>
        )
    }

    const showContent = isOpen || isSearching

    return (
        <div id={id} className={cn(
            "rounded-2xl border border-white/15 border-t-white/35 border-b-white/10",
            "bg-zinc-950/40 backdrop-blur-overlay-2xl backdrop-saturate-[190%]",
            "shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2),0_12px_36px_-6px_rgba(0,0,0,0.75)]",
            "overflow-hidden scroll-mt-28 transition-all duration-base",
            className
        )}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 sm:px-5 py-3 flex items-center justify-between text-left hover:bg-white/[0.04] transition-colors group select-none"
            >
                <div className="flex items-center gap-3.5 min-w-0 pr-4">
                    {Icon ? (
                        <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/15 border-t-white/30 flex items-center justify-center text-on-surface shrink-0 group-hover:scale-105 transition-all shadow-inner">
                            <Icon className="w-3.5 h-3.5 text-on-surface" />
                        </div>
                    ) : (
                        <div className="w-1.5 h-4.5 rounded-full bg-brand-accent shrink-0" />
                    )}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-black uppercase tracking-wider text-white font-mono group-hover:text-brand-accent transition-colors truncate">
                                {label}
                            </h3>
                            {badge}
                        </div>
                        {description && (
                            <p className="text-[11px] text-on-surface-variant/75 leading-normal font-medium line-clamp-1 mt-0.5">
                                {description}
                            </p>
                        )}
                    </div>
                </div>
                <div className={cn(
                    "w-6.5 h-6.5 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-on-surface-variant group-hover:text-white group-hover:bg-white/[0.08] transition-all duration-base ease-smooth-out shrink-0",
                    showContent && "rotate-180 text-white bg-white/10 border-white/20"
                )}>
                    <IconNavigationChevronDown className="w-3.5 h-3.5" />
                </div>
            </button>

            <AnimatePresence initial={false}>
                {showContent && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={collapseSpring}
                        className="overflow-hidden border-t border-white/[0.08]"
                    >
                        <div className="p-4 sm:p-5 space-y-3.5">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── SettingsCard ─────────────────────────────────────────────────────────────

export function SettingsCard({
    children,
    className,
    divide = true,
}: {
    children: React.ReactNode
    className?: string
    divide?: boolean
}) {
    return (
        <div className={cn(
            "rounded-2xl border border-white/15 border-t-white/35 border-b-white/10",
            "bg-zinc-950/40 backdrop-blur-overlay-2xl backdrop-saturate-[190%]",
            "shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2),0_12px_36px_-6px_rgba(0,0,0,0.75)]",
            "transition-all duration-base overflow-hidden",
            divide && "divide-y divide-white/[0.06]",
            className
        )}>
            {children}
        </div>
    )
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
                "flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 transition-colors duration-base ease-smooth-out gap-4 select-none group",
                disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.05]",
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
                    <p className="text-xs font-bold text-on-surface tracking-tight leading-snug group-hover:text-white transition-colors">
                        {label}
                    </p>
                    {description && (
                        <p className="text-[11px] text-on-surface-variant/70 leading-normal font-medium line-clamp-2">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3 hover:bg-white/[0.04] transition-colors duration-base ease-smooth-out">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {Icon && (
                    <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/20 border-t-white/30 flex items-center justify-center text-on-surface-variant shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                )}
                <div className="space-y-0.5 min-w-0 flex-1 py-0.5">
                    <p className="text-xs font-bold text-on-surface tracking-tight leading-snug">{label}</p>
                    {description && <p className="text-[11px] text-on-surface-variant/70 leading-normal font-medium line-clamp-2">{description}</p>}
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
                        "rounded-full bg-zinc-950/40 border border-white/20 border-t-white/40 border-b-white/10",
                        "pl-4 pr-1.5 py-1.5 text-left outline-none select-none cursor-pointer",
                        "shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.12)]",
                        "transition-colors duration-base ease-smooth-out hover:border-white/30 hover:bg-white/[0.06] active:scale-[0.98]",
                        "focus-visible:ring-2 focus-visible:ring-white/40",
                        "data-[state=open]:border-white/35 data-[state=open]:bg-white/[0.07] data-[state=open]:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_0_16px_rgba(255,255,255,0.12)]",
                        "data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed",
                        className
                    )}
                >
                    <span className="flex items-center gap-2 min-w-0 flex-1">
                        <motion.span
                            animate={{ scale: open ? 1.35 : 1 }}
                            transition={dotSpring}
                            className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                selected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-zinc-600"
                            )}
                        />
                        <span className="block truncate text-xs font-semibold text-white min-w-0">
                            {selected?.label ?? <span className="text-zinc-500 font-medium">{placeholder}</span>}
                        </span>
                        <span className="hidden">
                            <SelectPrimitive.Value placeholder={placeholder} />
                        </span>
                    </span>
                    <motion.span
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={chevronSpring}
                        className={cn(
                            "w-6 h-6 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-300 shrink-0",
                            "transition-colors duration-base ease-smooth-out group-hover:bg-white/[0.12] group-hover:text-white group-data-[state=open]:bg-white group-data-[state=open]:text-zinc-950 group-data-[state=open]:border-white"
                        )}
                    >
                        <IconNavigationChevronDown className="w-3.5 h-3.5" />
                    </motion.span>
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
                            "bg-zinc-950/85 backdrop-blur-overlay-2xl backdrop-saturate-[190%]",
                            "shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2),0_12px_36px_-6px_rgba(0,0,0,0.75)]",
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
                                        style={{ animationDelay: `${Math.min(idx, 6) * 20}ms` }}
                                        className={cn(
                                            "relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 outline-none cursor-pointer select-none",
                                            "transition-colors duration-base ease-smooth-out active:scale-[0.98]",
                                            "data-[highlighted]:bg-white/[0.08] data-[highlighted]:text-white",
                                            "data-[state=checked]:bg-white/[0.08]",
                                            "data-[disabled]:opacity-40 data-[disabled]:pointer-events-none",
                                            "focus-visible:ring-1 focus-visible:ring-white/30",
                                            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1",
                                            "motion-reduce:animate-none motion-reduce:transition-none"
                                        )}
                                    >
                                        <span className={cn(
                                            "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all duration-base ease-bounce-spring",
                                            isActive
                                                ? "bg-white border-white text-zinc-950 shadow-[0_0_10px_rgba(255,255,255,0.5)] scale-100"
                                                : "border-white/25 bg-transparent text-transparent scale-90"
                                        )}>
                                            <IconUiCheck className="w-3 h-3" strokeWidth={3} />
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <span className={cn(
                                                "block truncate text-xs leading-tight",
                                                isActive ? "font-bold text-white" : "font-semibold text-zinc-200"
                                            )}>
                                                {opt.label}
                                            </span>
                                            {opt.desc && (
                                                <span className="block truncate text-[11px] text-zinc-400 leading-tight mt-0.5">
                                                    {opt.desc}
                                                </span>
                                            )}
                                        </span>
                                        {opt.badge && (
                                            <span className={cn(
                                                "shrink-0 text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                                isActive
                                                    ? "bg-white text-zinc-950 border-white"
                                                    : "bg-white/[0.06] text-zinc-300 border-white/15"
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
}

export const OsInput = React.forwardRef<HTMLInputElement, OsInputProps>(({
    label,
    description,
    placeholder,
    isSecure = false,
    isMono = false,
    type = "text",
    icon: Icon,
    className,
    ...props
}, ref) => {
    const [showSecure, setShowSecure] = React.useState(false)

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3 hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {Icon && (
                    <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/20 border-t-white/30 flex items-center justify-center text-on-surface-variant shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                )}
                <div className="space-y-0.5 min-w-0 max-w-xl py-0.5">
                    <p className="text-xs font-bold text-on-surface tracking-tight leading-snug">{label}</p>
                    {description && <p className="text-[11px] text-on-surface-variant/70 leading-normal font-medium line-clamp-2">{description}</p>}
                </div>
            </div>

            <div className={cn(
                "flex items-center gap-2 bg-zinc-950/40 border border-white/20 border-t-white/40 border-b-white/10 rounded-full pl-4 pr-3 py-2 w-full sm:w-64 lg:w-72 transition-all relative",
                "shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.12)]",
                "focus-within:border-white/35 focus-within:bg-white/[0.06] focus-within:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2),0_0_16px_rgba(255,255,255,0.1)] hover:border-white/30",
                className
            )}>
                <input
                    ref={ref}
                    type={isSecure ? (showSecure ? "text" : "password") : type}
                    placeholder={placeholder}
                    className={cn(
                        "flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant/40 text-xs focus:outline-none",
                        isSecure && "pr-6",
                        isMono && "font-mono text-[11px]"
                    )}
                    {...props}
                />

                {isSecure && (
                    <button
                        type="button"
                        onClick={() => setShowSecure(!showSecure)}
                        className="absolute right-3 text-on-surface-variant/70 hover:text-on-surface transition-colors p-1"
                    >
                        {showSecure ? <IconUiEyeOff className="w-3.5 h-3.5" /> : <IconUiEye className="w-3.5 h-3.5" />}
                    </button>
                )}
            </div>
        </div>
    )
})

OsInput.displayName = "OsInput"

// ─── PathList ─────────────────────────────────────────────────────────────────

export interface PathListProps {
    label: string
    directories: string[]
    onAdd: (path: string) => void
    onRemove: (path: string) => void
    placeholder?: string
    icon?: React.ElementType
    className?: string
}

export function PathList({ label, directories, onAdd, onRemove, placeholder, icon: Icon, className }: PathListProps) {
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
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant border border-white/10 shrink-0">
                        {directories.length} {directories.length === 1 ? "ruta" : "rutas"}
                    </span>
                </div>

                {directories.length > 0 ? (
                    <div className="space-y-2">
                        {directories.map((dir) => (
                            <div key={dir} className="flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 group/path hover:border-white/20 transition-all">
                                <span className="text-xs text-on-surface-variant font-mono truncate mr-3">{dir}</span>
                                <button
                                    type="button"
                                    onClick={() => onRemove(dir)}
                                    className="text-on-surface-variant/70 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10 shrink-0"
                                    title="Eliminar ruta"
                                >
                                    <IconUiDelete className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-3 rounded-xl border border-dashed border-white/10 text-center">
                        <p className="text-[11px] text-on-surface-variant/50 font-medium">
                            Sin carpetas añadidas
                        </p>
                    </div>
                )}
            </div>

            <div
                className="mt-3"
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault()
                        handleAdd()
                    }
                }}
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
                            className="h-9 pl-3.5 pr-4 rounded-full text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 bg-brand-accent text-white shadow-brand-primary hover:brightness-110 disabled:bg-white/[0.07] disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:brightness-100"
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
