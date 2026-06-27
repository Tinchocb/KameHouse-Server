import React from "react"
import { cn } from "@/components/ui/core/styling"
import { Switch } from "@/components/ui/switch"
import { useMutation } from "@tanstack/react-query"
import { useServerMutation } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { DirectorySelector_Variables } from "@/api/generated/endpoint.types"
import { toast } from "sonner"

// ─── Inline SVGs ──────────────────────────────────────────────────────────────

export const RefreshIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
    </svg>
)

export const PlusIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
    </svg>
)

export const TrashIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
)

export const FolderIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
)

export const EyeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
)

export const EyeOffIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
)

export const ChevronDownIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m6 9 6 6 6-6" />
    </svg>
)

export const CheckIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M20 6 9 17l-5-5" />
    </svg>
)

export const WifiIcon = ({ className, style }: { className?: string, style?: React.CSSProperties }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
        <path d="M12 20h.01" />
        <path d="M8.5 16.5a5 5 0 0 1 7 0" />
        <path d="M5 13a10 10 0 0 1 14 0" />
        <path d="M1.5 9.5a15 15 0 0 1 21 0" />
    </svg>
)

export const WifiOffIcon = ({ className, style }: { className?: string, style?: React.CSSProperties }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
        <path d="M1 1l22 22" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 13" />
        <path d="M5 13a10.94 10.94 0 0 1 5.83-2.84" />
        <path d="M12 20h.01" />
        <path d="M8.5 16.5a5 5 0 0 1 7 0" />
        <path d="M21.3 4.7a15 15 0 0 0-18.6 0" />
    </svg>
)

// ─── ScanButton ────────────────────────────────────────────────────────────────

export function ScanButton({ variant, onClick, loading }: { variant: "delta" | "full", onClick: () => void, loading?: boolean }) {
    const isDelta = variant === "delta"
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={loading}
            className={cn(
                "flex-1 flex items-center justify-between p-6 rounded-2xl border transition-all duration-500 relative overflow-hidden group/scanbtn",
                isDelta
                    ? "bg-cyan-500/8 border-cyan-500/20 hover:bg-cyan-500/15 hover:border-cyan-500/35 text-cyan-400"
                    : "liquid-glass-frosted-subtle hover:bg-surface-2/60 hover:border-border-strong text-white",
                loading && "opacity-50 cursor-not-allowed"
            )}
        >
            {isDelta && (
                <div className="absolute inset-0 opacity-0 group-hover/scanbtn:opacity-100 transition-opacity duration-700 bg-[radial-gradient(ellipse_at_left_bottom,rgba(6,182,212,0.08),transparent_60%)] pointer-events-none" />
            )}
            <div className="text-left relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-50 mb-1 group-hover/scanbtn:opacity-80 transition-opacity">
                    {isDelta ? "Rápido" : "Profundo"}
                </p>
                <p className="text-xl font-bebas tracking-wider uppercase">{isDelta ? "Escaneo Delta" : "Escaneo Completo"}</p>
            </div>
            <div className={cn(
                "w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-300",
                isDelta
                    ? "bg-cyan-500/15 border-cyan-500/25 group-hover/scanbtn:bg-cyan-500/25"
                    : "bg-white/[0.04] border-white/8 group-hover/scanbtn:bg-white/[0.08]"
            )}>
                <RefreshIcon
                    className={cn(
                        "transition-all duration-700",
                        isDelta ? "text-cyan-400" : "text-white/80 group-hover/scanbtn:text-white",
                        loading ? "animate-spin" : "group-hover/scanbtn:rotate-180"
                    )}
                />
            </div>
        </button>
    )
}

// ─── IntegrationCard ──────────────────────────────────────────────────────────

const SERVICE_COLORS: Record<string, string> = {
    TMDB: "#01B4E4",
}

export function IntegrationCard({ name, status, connected, disabled }: { name: string; status: string; connected: boolean; disabled?: boolean }) {
    const color = SERVICE_COLORS[name] || "#ffffff"

    return (
        <div className={cn(
            "p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden group/intcard transition-all duration-300",
            disabled
                ? "opacity-40 liquid-glass-frosted-subtle"
                : connected
                    ? "liquid-glass-frosted hover:border-white/20"
                    : "liquid-glass-frosted-subtle hover:bg-surface-2/60 hover:border-border-strong"
        )}>
            {connected && (
                <div
                    className="absolute inset-0 opacity-0 group-hover/intcard:opacity-100 transition-opacity duration-700 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at left, ${color}10, transparent 60%)` }}
                />
            )}

            <div
                className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-300 group-hover/intcard:scale-105"
                style={{
                    background: `${color}15`,
                    borderColor: `${color}30`,
                    boxShadow: connected ? `0 0 24px ${color}20` : "none"
                }}
            >
                {connected
                    ? <WifiIcon style={{ color }} />
                    : <WifiOffIcon className="text-zinc-500" />
                }
            </div>

            <div className="flex-1 min-w-0">
                <p className="font-bebas text-xl tracking-wider uppercase text-white/90 group-hover/intcard:text-white transition-colors leading-none">{name}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">{status}</p>
            </div>

            {connected && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-[9px] font-black tracking-widest uppercase text-emerald-400">OK</span>
                </div>
            )}

            {!connected && !disabled && (
                <span className="text-[9px] font-black tracking-widest uppercase text-zinc-500 border border-zinc-700/50 px-2.5 py-1 rounded-full group-hover/intcard:border-zinc-600 group-hover/intcard:text-zinc-400 transition-colors shrink-0">
                    DISPONIBLE
                </span>
            )}

            {disabled && (
                <span className="text-[9px] font-black tracking-widest uppercase text-zinc-600 border border-zinc-800/50 px-2.5 py-1 rounded-full shrink-0">
                    PRONTO
                </span>
            )}
        </div>
    )
}

// ─── StatusCard ───────────────────────────────────────────────────────────────

export function StatusCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
    return (
        <div className="p-6 liquid-glass-frosted-subtle hover:border-cyan-500/30 rounded-2xl flex items-center gap-4 group/statuscard relative overflow-hidden transition-all duration-300">
            <div className="absolute inset-0 opacity-0 group-hover/statuscard:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_at_left,rgba(6,182,212,0.08),transparent_70%)] pointer-events-none" />
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover/statuscard:text-cyan-300 group-hover/statuscard:bg-cyan-500/15 transition-all duration-300 relative z-10">
                <Icon className="w-5 h-5" />
            </div>
            <div className="relative z-10">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-0.5 font-mono">{label}</p>
                <p className="text-xl font-bebas tracking-wider uppercase text-white/95 group-hover/statuscard:text-white transition-colors leading-tight">{value}</p>
            </div>
        </div>
    )
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function Section({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <section className="space-y-4">
            <div className="flex items-center gap-3 pl-1">
                <div className="w-1 h-4 rounded-full bg-[#ff6e3a]/60" />
                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400 font-mono">
                    {label}
                </h2>
            </div>
            {children}
        </section>
    )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("liquid-glass-frosted rounded-2xl p-6", className)}>
            {children}
        </div>
    )
}

// ─── PathList ─────────────────────────────────────────────────────────────────

export interface PathListProps {
    label: string
    directories: string[]
    onAdd: (path: string) => void
    onRemove: (path: string) => void
    placeholder?: string
}

export function PathList({ label, directories, onAdd, onRemove, placeholder }: PathListProps) {
    const [inputValue, setInputValue] = React.useState("")

    const handleAdd = () => {
        if (inputValue.trim()) {
            onAdd(inputValue.trim())
            setInputValue("")
        }
    }

    return (
        <div className="p-6 space-y-4">
            <div className="space-y-1">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wide">{label}</h4>
            </div>

            {directories.length > 0 && (
                <div className="space-y-2">
                    {directories.map((dir) => (
                        <div key={dir} className="flex items-center justify-between bg-surface-2/50 border border-border-subtle rounded-xl px-4 py-2.5">
                            <span className="text-xs text-zinc-300 font-mono truncate mr-4">{dir}</span>
                            <button
                                type="button"
                                onClick={() => onRemove(dir)}
                                className="text-zinc-500 hover:text-red-400 transition-colors duration-200 p-1 rounded-lg hover:bg-white/5"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-2.5 bg-surface-2/40 border border-border-subtle rounded-xl pl-1 pr-1.5 py-1 focus-within:border-[#ff6e3a]/40 transition-all">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent px-3 py-2 text-white placeholder-zinc-600 text-xs font-mono focus:outline-none"
                />
                <button
                    type="button"
                    onClick={handleAdd}
                    className="bg-[#ff6e3a] hover:bg-[#ff7e4e] text-zinc-950 px-5 py-2.5 rounded-lg font-black uppercase text-[10px] tracking-wider transition-all shrink-0 flex items-center gap-1.5 active:scale-95 shadow-lg shadow-orange-500/20"
                >
                    <PlusIcon />
                    AGREGAR
                </button>
            </div>
        </div>
    )
}

// ─── OsInput ─────────────────────────────────────────────────────────────────

export interface OsInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string
    description?: string
    isSecure?: boolean
    isMono?: boolean
}

export const OsInput = React.forwardRef<HTMLInputElement, OsInputProps>(({
    label,
    description,
    placeholder,
    isSecure = false,
    isMono = false,
    type = "text",
    className,
    ...props
}, ref) => {
    const [showSecure, setShowSecure] = React.useState(false)

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.01] transition-all duration-200 gap-5 group/input">
            <div className="space-y-1 flex-1 max-w-xl">
                <p className="text-sm font-semibold text-zinc-300 group-hover/input:text-white transition-colors tracking-tight">{label}</p>
                {description && <p className="text-[11px] text-zinc-500 leading-relaxed font-medium group-hover/input:text-zinc-400 transition-colors duration-300">{description}</p>}
            </div>
            <div className={cn(
                "flex items-center gap-2.5 bg-surface-2/60 border border-border-strong rounded-xl px-4 py-3 w-full md:w-72 transition-all relative",
                "focus-within:border-[#ff6e3a]/50 focus-within:shadow-[0_0_24px_rgba(255,110,58,0.15)] focus-within:bg-surface-2/80 hover:border-white/15",
                className
            )}>
                <input
                    ref={ref}
                    type={isSecure ? (showSecure ? "text" : "password") : type}
                    placeholder={placeholder}
                    className={cn(
                        "flex-1 bg-transparent text-white placeholder-zinc-600 text-xs focus:outline-none pr-5",
                        isMono && "font-mono text-[11px] tracking-tight"
                    )}
                    {...props}
                />
                {isSecure && (
                    <button
                        type="button"
                        onClick={() => setShowSecure(!showSecure)}
                        className="absolute right-3.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        {showSecure ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                )}
            </div>
        </div>
    )
})

OsInput.displayName = "OsInput"

// ─── OsSelect ─────────────────────────────────────────────────────────────────

export interface OsSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string
    description?: string
    options: { value: string; label: string }[]
}

export const OsSelect = React.forwardRef<HTMLSelectElement, OsSelectProps>(({
    label,
    description,
    options,
    className,
    ...props
}, ref) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.01] transition-all duration-200 gap-5 group/select">
            <div className="space-y-1 flex-1 max-w-xl">
                <p className="text-sm font-semibold text-zinc-300 group-hover/select:text-white transition-colors tracking-tight">{label}</p>
                {description && <p className="text-[11px] text-zinc-500 leading-relaxed font-medium group-hover/select:text-zinc-400 transition-colors duration-300">{description}</p>}
            </div>
            <div className={cn(
                "flex items-center bg-surface-2/60 border border-border-strong rounded-xl px-4 py-3 w-full md:w-72 transition-all relative cursor-pointer",
                "focus-within:border-[#ff6e3a]/50 focus-within:shadow-[0_0_24px_rgba(255,110,58,0.15)] focus-within:bg-surface-2/80 hover:border-white/15",
                className
            )}>
                <select
                    ref={ref}
                    className="flex-1 bg-transparent text-white text-xs focus:outline-none appearance-none cursor-pointer pr-6 font-medium [&>option]:bg-[#141418] [&>option]:text-white"
                    {...props}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <div className="absolute right-3.5 pointer-events-none text-zinc-500 group-hover/select:text-zinc-300 transition-colors">
                    <ChevronDownIcon />
                </div>
            </div>
        </div>
    )
})

OsSelect.displayName = "OsSelect"

// ─── OsToggle ─────────────────────────────────────────────────────────────────

export interface OsToggleProps {
    label: string
    description?: string
    checked: boolean
    onChange: (value: boolean) => void
    disabled?: boolean
}

export function OsToggle({ label, description, checked, onChange, disabled }: OsToggleProps) {
    return (
        <div
            className="flex flex-col md:flex-row md:items-center justify-between px-6 py-5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.01] transition-all duration-200 gap-5 group/toggle cursor-pointer"
            onClick={() => !disabled && onChange(!checked)}
        >
            <div className="space-y-1 flex-1 max-w-xl">
                <p className="text-sm font-semibold text-zinc-300 group-hover/toggle:text-white transition-colors tracking-tight">{label}</p>
                {description && <p className="text-[11px] text-zinc-500 leading-relaxed font-medium group-hover/toggle:text-zinc-400 transition-colors duration-300">{description}</p>}
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={(e) => { e.stopPropagation(); onChange(!checked) }}
                className={cn(
                    "relative shrink-0 w-10 h-[22px] rounded-full border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6e3a]/50",
                    checked
                        ? "bg-[#ff6e3a] border-[#ff6e3a] shadow-[0_0_16px_rgba(255,110,58,0.4)]"
                        : "bg-surface-3/80 border-border-strong hover:border-white/25 hover:bg-surface-3",
                    disabled && "opacity-40 cursor-not-allowed"
                )}
            >
                <span className={cn(
                    "absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200",
                    checked && "translate-x-[18px]"
                )} />
            </button>
        </div>
    )
}
