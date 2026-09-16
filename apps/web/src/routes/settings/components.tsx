import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { IconNavigationChevronDown, IconUiEyeOff, IconUiEye, IconUiDelete, IconUiPlus } from "@/components/ui/icons";
import { DirectorySelector } from "@/components/shared/directory-selector"

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
                    "w-6.5 h-6.5 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-on-surface-variant group-hover:text-white group-hover:bg-white/[0.08] transition-all shrink-0",
                    showContent && "rotate-180 text-white bg-white/10 border-white/20"
                )}>
                    <IconNavigationChevronDown className="w-3.5 h-3.5 transition-transform duration-base" />
                </div>
            </button>

            <AnimatePresence initial={false}>
                {showContent && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
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
                "flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 transition-all duration-200 gap-4 select-none group",
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

export interface OsSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string
    description?: string
    options: { value: string; label: string }[]
    icon?: React.ElementType
}

export const OsSelect = React.forwardRef<HTMLSelectElement, OsSelectProps>(({
    label,
    description,
    options,
    icon: Icon,
    className,
    ...props
}, ref) => {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 gap-3 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {Icon && (
                    <div className="w-6.5 h-6.5 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-on-surface-variant shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                )}
                <div className="space-y-0.5 min-w-0 flex-1 py-0.5">
                    <p className="text-xs font-bold text-on-surface tracking-tight leading-snug">{label}</p>
                    {description && <p className="text-[11px] text-on-surface-variant/70 leading-normal font-medium line-clamp-2">{description}</p>}
                </div>
            </div>

            <div className={cn(
                "relative flex items-center bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5 w-full sm:w-auto sm:min-w-[220px] sm:max-w-sm transition-all cursor-pointer shrink-0",
                "focus-within:border-brand-accent/50 focus-within:shadow-[0_0_12px_hsl(var(--brand-accent)/0.2)] focus-within:bg-white/[0.07] hover:border-white/20",
                className
            )}>
                <select
                    ref={ref}
                    className="w-full bg-transparent text-on-surface text-xs font-medium focus:outline-none appearance-none cursor-pointer pr-6 truncate [background-image:none] border-none p-0 outline-none ring-0 [&>option]:bg-zinc-950 [&>option]:text-white"
                    {...props}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-zinc-950 text-white py-1">
                            {opt.label}
                        </option>
                    ))}
                </select>
                <div className="absolute right-3 pointer-events-none text-on-surface-variant/70 transition-colors">
                    <IconNavigationChevronDown className="w-3.5 h-3.5" />
                </div>
            </div>
        </div>
    )
})

OsSelect.displayName = "OsSelect"

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 gap-3 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {Icon && (
                    <div className="w-6.5 h-6.5 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-on-surface-variant shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                )}
                <div className="space-y-0.5 min-w-0 max-w-xl py-0.5">
                    <p className="text-xs font-bold text-on-surface tracking-tight leading-snug">{label}</p>
                    {description && <p className="text-[11px] text-on-surface-variant/70 leading-normal font-medium line-clamp-2">{description}</p>}
                </div>
            </div>

            <div className={cn(
                "flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5 w-full sm:w-64 lg:w-72 transition-all relative",
                "focus-within:border-brand-accent/50 focus-within:shadow-[0_0_12px_hsl(var(--brand-accent)/0.2)] focus-within:bg-white/[0.07] hover:border-white/20",
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
    const [inputValue, setInputValue] = React.useState("")
    const [selectedPath, setSelectedPath] = React.useState("")

    const handleAdd = () => {
        const path = inputValue.trim() || selectedPath
        if (path) {
            onAdd(path)
            setInputValue("")
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

            <div className="space-y-2 mt-3">
                <DirectorySelector
                    value={selectedPath}
                    onSelect={handleDirectorySelect}
                    shouldExist={true}
                    placeholder={placeholder}
                    label={false}
                />

                <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl p-1.5 focus-within:border-brand-accent/50 hover:border-white/20 transition-all">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault()
                                handleAdd()
                            }
                        }}
                        placeholder={placeholder}
                        className="flex-1 min-w-0 bg-transparent px-2.5 py-1 text-on-surface placeholder:text-on-surface-variant/40 text-xs font-mono focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={handleAdd}
                        className="bg-brand-accent hover:brightness-110 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 shadow-sm"
                    >
                        <IconUiPlus className="w-3.5 h-3.5" />
                        <span>Agregar</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
