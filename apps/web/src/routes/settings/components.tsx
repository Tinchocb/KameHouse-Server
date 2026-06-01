import React from "react"
import { cn } from "@/components/ui/core/styling"
import {
    LucideRefreshCw, LucidePlus, LucideTrash2, LucideFolder,
    LucideEye, LucideEyeOff, LucideChevronDown, LucideCheck,
    LucideWifi, LucideWifiOff, LucideZap
} from "lucide-react"
import { Controller, type Control, type Path, type FieldValues } from "react-hook-form"
import { Switch } from "@/components/ui/switch"

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
                    ? "bg-brand-orange/5 border-brand-orange/15 hover:bg-brand-orange/10 hover:border-brand-orange/30 text-brand-orange shadow-[0_0_30px_rgba(235,94,40,0.03)]"
                    : "bg-white/[0.01] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/15 text-white",
                loading && "opacity-50 cursor-not-allowed"
            )}
        >
            {/* Subtle background glow */}
            {isDelta && (
                <div className="absolute inset-0 opacity-0 group-hover/scanbtn:opacity-100 transition-opacity duration-700 bg-[radial-gradient(ellipse_at_left_bottom,rgba(235,94,40,0.06),transparent_60%)] pointer-events-none" />
            )}
            <div className="text-left relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-40 mb-1 group-hover/scanbtn:opacity-70 transition-opacity">
                    {isDelta ? "Rápido" : "Profundo"}
                </p>
                <p className="text-xl font-bebas tracking-wider uppercase">{isDelta ? "Escaneo Delta" : "Escaneo Completo"}</p>
            </div>
            <div className={cn(
                "w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-300",
                isDelta
                    ? "bg-brand-orange/10 border-brand-orange/20 group-hover/scanbtn:bg-brand-orange/20"
                    : "bg-white/[0.02] border-white/5 group-hover/scanbtn:bg-white/[0.06]"
            )}>
                <LucideRefreshCw
                    size={16}
                    className={cn(
                        "transition-all duration-700",
                        isDelta ? "text-brand-orange" : "text-white/75 group-hover/scanbtn:text-white",
                        loading ? "animate-spin" : "group-hover/scanbtn:rotate-180"
                    )}
                />
            </div>
        </button>
    )
}

// ─── IntegrationCard ──────────────────────────────────────────────────────────

const SERVICE_COLORS: Record<string, string> = {
    AniList: "#02A9FF",
    MyAnimeList: "#2E51A2",
    TMDB: "#01B4E4",
}

export function IntegrationCard({ name, status, connected, disabled }: { name: string; status: string; connected: boolean; disabled?: boolean }) {
    const color = SERVICE_COLORS[name] || "#ffffff"

    return (
        <div className={cn(
            "p-5 border rounded-2xl backdrop-blur-md flex items-center gap-4 transition-all duration-500 relative overflow-hidden group/intcard",
            disabled
                ? "opacity-30 grayscale border-white/5 bg-white/[0.01]"
                : connected
                    ? "border-white/[0.08] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                    : "border-white/[0.05] bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02]"
        )}>
            {/* Color glow for connected */}
            {connected && (
                <div
                    className="absolute inset-0 opacity-0 group-hover/intcard:opacity-100 transition-opacity duration-700 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at left, ${color}08, transparent 60%)` }}
                />
            )}

            {/* Logo icon */}
            <div
                className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-300 group-hover/intcard:scale-105"
                style={{
                    background: `${color}10`,
                    borderColor: `${color}25`,
                    boxShadow: connected ? `0 0 20px ${color}15` : "none"
                }}
            >
                {connected
                    ? <LucideWifi size={18} style={{ color }} />
                    : <LucideWifiOff size={18} className="text-zinc-500" />
                }
            </div>

            <div className="flex-1 min-w-0">
                <p className="font-bebas text-xl tracking-wider uppercase text-white/90 group-hover/intcard:text-white transition-colors leading-none">{name}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">{status}</p>
            </div>

            {connected && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-[9px] font-black tracking-widest uppercase text-emerald-400">OK</span>
                </div>
            )}

            {!connected && !disabled && (
                <span className="text-[9px] font-black tracking-widest uppercase text-zinc-500 border border-zinc-800 px-2.5 py-1 rounded-full group-hover/intcard:border-zinc-700 group-hover/intcard:text-zinc-400 transition-colors shrink-0">
                    DISPONIBLE
                </span>
            )}

            {disabled && (
                <span className="text-[9px] font-black tracking-widest uppercase text-zinc-600 border border-zinc-900 px-2.5 py-1 rounded-full shrink-0">
                    PRONTO
                </span>
            )}
        </div>
    )
}

// ─── StatusCard ───────────────────────────────────────────────────────────────

export function StatusCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
    return (
        <div className="p-5 border border-white/[0.05] bg-white/[0.02] backdrop-blur-md rounded-2xl flex items-center gap-4 transition-all duration-300 hover:bg-white/[0.04] hover:border-white/10 group/statuscard relative overflow-hidden">
            <div className="absolute inset-0 opacity-0 group-hover/statuscard:opacity-100 transition-opacity duration-700 bg-[radial-gradient(ellipse_at_left,rgba(235,94,40,0.04),transparent_70%)] pointer-events-none" />
            <div className="w-11 h-11 rounded-xl bg-brand-orange/5 border border-brand-orange/10 flex items-center justify-center text-brand-orange/60 group-hover/statuscard:text-brand-orange group-hover/statuscard:bg-brand-orange/10 transition-all duration-300 relative z-10">
                <Icon size={18} />
            </div>
            <div className="relative z-10">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-0.5">{label}</p>
                <p className="text-xl font-bebas tracking-wider uppercase text-white/90 group-hover/statuscard:text-white transition-colors leading-tight">{value}</p>
            </div>
        </div>
    )
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function Section({ label, children, right }: { label: string; children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div className="space-y-5 w-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-[1px] w-4 bg-gradient-to-r from-brand-orange/60 to-transparent" />
                    <p className="text-[9px] font-black uppercase tracking-[0.35em] text-zinc-500">{label}</p>
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-white/5 to-transparent min-w-[60px]" />
                </div>
                {right}
            </div>
            {children}
        </div>
    )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn(
            "overflow-hidden bg-zinc-950/60 backdrop-blur-md border border-white/[0.06] rounded-2xl",
            "transition-all duration-300 hover:border-white/[0.10] hover:shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)]",
            className
        )}>
            {children}
        </div>
    )
}

// ─── OsToggle ─────────────────────────────────────────────────────────────────

export interface OsToggleProps<T extends FieldValues> {
    control: Control<T>
    name: Path<T>
    label: string
    desc?: string
    disabled?: boolean
    onSave?: () => void
}

export function OsToggle<T extends FieldValues>({ control, name, label, desc, disabled, onSave }: OsToggleProps<T>) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field }) => (
                <div className={cn(
                    "flex items-center justify-between px-6 py-4 border-b border-white/[0.03] last:border-0 transition-all duration-200 gap-8 group/toggle relative",
                    field.value && "bg-brand-orange/[0.02]",
                    disabled
                        ? "opacity-40 cursor-not-allowed pointer-events-none"
                        : "hover:bg-white/[0.02] cursor-pointer"
                )}
                    onClick={() => {
                        if (disabled) return
                        field.onChange(!field.value)
                        onSave?.()
                    }}
                >
                    {/* Left active accent */}
                    <div className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-r-full transition-all duration-300",
                        field.value ? "h-6 bg-brand-orange shadow-[0_0_8px_rgba(235,94,40,0.6)]" : "h-0 bg-transparent"
                    )} />

                    <div className="space-y-0.5 flex-1 pl-2">
                        <p className={cn(
                            "text-sm font-semibold tracking-tight transition-colors duration-200",
                            field.value ? "text-white" : "text-zinc-300 group-hover/toggle:text-white"
                        )}>{label}</p>
                        {desc && <p className="text-xs text-zinc-600 leading-relaxed font-medium group-hover/toggle:text-zinc-500 transition-colors">{desc}</p>}
                    </div>
                    <Switch
                        value={!!field.value}
                        onValueChange={(v: boolean) => {
                            if (disabled) return
                            field.onChange(v)
                            onSave?.()
                        }}
                        disabled={disabled}
                        className="scale-[0.9] origin-right transition-all duration-300 data-[state=checked]:bg-brand-orange shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        />
    )
}

// ─── PathList ─────────────────────────────────────────────────────────────────

export function PathList<T extends FieldValues>({ control, name, label, placeholder }: { control: Control<T>, name: Path<T>, label: string, placeholder?: string }) {
    const [inputValue, setInputValue] = React.useState("")

    return (
        <Controller
            control={control}
            name={name}
            render={({ field }) => {
                const paths = (Array.isArray(field.value) ? field.value : []) as string[]

                const handleAdd = () => {
                    if (inputValue.trim() && !paths.includes(inputValue.trim())) {
                        field.onChange([...paths, inputValue.trim()])
                        setInputValue("")
                    }
                }

                const handleRemove = (indexToRemove: number) => {
                    field.onChange(paths.filter((_, idx) => idx !== indexToRemove))
                }

                return (
                    <div className="p-7 space-y-5">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-brand-orange/5 border border-brand-orange/10 flex items-center justify-center">
                                    <LucideFolder size={13} className="text-brand-orange/60" />
                                </div>
                                <p className="text-base font-bebas tracking-wider text-white uppercase">{label}</p>
                            </div>
                            <p className="text-xs text-zinc-600 font-medium leading-relaxed max-w-xl pl-10">
                                Directorios locales vinculados a este motor. El escáner analizará estos directorios de forma recursiva.
                            </p>
                        </div>

                        {/* List of paths */}
                        <div className="space-y-2">
                            {paths.length === 0 ? (
                                <div className="border border-dashed border-white/[0.04] bg-white/[0.005] p-6 rounded-xl text-center space-y-1">
                                    <LucideFolder size={20} className="text-zinc-700 mx-auto mb-2" />
                                    <p className="text-zinc-600 text-xs font-medium">No hay directorios configurados</p>
                                    <p className="text-zinc-700 text-[10px] uppercase tracking-[0.2em]">Agrega uno con el campo de abajo</p>
                                </div>
                            ) : (
                                paths.map((path: string, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between bg-white/[0.01] border border-white/[0.05] px-4 py-3 rounded-xl hover:bg-white/[0.03] hover:border-white/10 transition-all duration-200 group/pathitem">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <LucideCheck size={12} className="text-brand-orange/60 shrink-0" />
                                            <span className="font-mono text-xs text-zinc-400 truncate group-hover/pathitem:text-zinc-200 transition-colors">{path}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(idx)}
                                            className="text-zinc-700 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/10 transition-all ml-3 shrink-0"
                                        >
                                            <LucideTrash2 size={13} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Input to add path */}
                        <div className="flex gap-2 bg-black/50 border border-white/[0.06] focus-within:border-brand-orange/20 focus-within:shadow-[0_0_20px_rgba(235,94,40,0.04)] rounded-xl p-1.5 transition-all">
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
                                placeholder={placeholder || "Ej. C:\\Media\\Peliculas"}
                                className="flex-1 bg-transparent px-4 py-2 text-white placeholder-zinc-700 text-xs font-mono focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={handleAdd}
                                className="bg-brand-orange hover:bg-brand-orange/90 text-black px-5 py-2 rounded-lg font-black uppercase text-[9px] tracking-[0.2em] transition-all shrink-0 flex items-center gap-1.5 active:scale-95"
                            >
                                <LucidePlus size={12} />
                                AGREGAR
                            </button>
                        </div>
                    </div>
                )
            }}
        />
    )
}

// ─── OsInput ─────────────────────────────────────────────────────────────────

export interface OsInputProps<T extends FieldValues> {
    control: Control<T>
    name: Path<T>
    label: string
    desc?: string
    placeholder?: string
    isSecure?: boolean
    isMono?: boolean
    type?: "text" | "number"
}

export function OsInput<T extends FieldValues>({
    control,
    name,
    label,
    desc,
    placeholder,
    isSecure = false,
    isMono = false,
    type = "text"
}: OsInputProps<T>) {
    const [showSecure, setShowSecure] = React.useState(false)

    return (
        <Controller
            control={control}
            name={name}
            render={({ field }) => (
                <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.015] transition-all duration-200 gap-5 group/input">
                    <div className="space-y-0.5 flex-1 max-w-xl">
                        <p className="text-sm font-semibold text-zinc-200 group-hover/input:text-white transition-colors tracking-tight">{label}</p>
                        {desc && <p className="text-xs text-zinc-600 leading-relaxed font-medium">{desc}</p>}
                    </div>
                    <div className={cn(
                        "flex items-center gap-2 bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 w-full md:w-72 transition-all relative",
                        "focus-within:border-brand-orange/30 focus-within:shadow-[0_0_16px_rgba(235,94,40,0.07)] hover:border-white/10"
                    )}>
                        <input
                            type={isSecure ? (showSecure ? "text" : "password") : type}
                            placeholder={placeholder}
                            value={field.value ?? ""}
                            onChange={(e) => {
                                const val = type === "number" ? (e.target.value === "" ? 0 : Number(e.target.value)) : e.target.value
                                field.onChange(val)
                            }}
                            className={cn(
                                "flex-1 bg-transparent text-white placeholder-zinc-700 text-xs focus:outline-none pr-5",
                                isMono && "font-mono text-[11px] tracking-tight"
                            )}
                        />
                        {isSecure && (
                            <button
                                type="button"
                                onClick={() => setShowSecure(!showSecure)}
                                className="absolute right-3 text-zinc-600 hover:text-zinc-300 transition-colors"
                            >
                                {showSecure ? <LucideEyeOff size={13} /> : <LucideEye size={13} />}
                            </button>
                        )}
                    </div>
                </div>
            )}
        />
    )
}

// ─── OsSelect ─────────────────────────────────────────────────────────────────

export interface OsSelectProps<T extends FieldValues> {
    control: Control<T>
    name: Path<T>
    label: string
    desc?: string
    options: { value: string; label: string }[]
}

export function OsSelect<T extends FieldValues>({
    control,
    name,
    label,
    desc,
    options
}: OsSelectProps<T>) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field }) => (
                <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.015] transition-all duration-200 gap-5 group/select">
                    <div className="space-y-0.5 flex-1 max-w-xl">
                        <p className="text-sm font-semibold text-zinc-200 group-hover/select:text-white transition-colors tracking-tight">{label}</p>
                        {desc && <p className="text-xs text-zinc-600 leading-relaxed font-medium">{desc}</p>}
                    </div>
                    <div className={cn(
                        "flex items-center bg-black/50 border border-white/[0.06] rounded-xl px-4 py-2.5 w-full md:w-72 transition-all relative cursor-pointer",
                        "focus-within:border-brand-orange/30 focus-within:shadow-[0_0_16px_rgba(235,94,40,0.07)] hover:border-white/10"
                    )}>
                        <select
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="flex-1 bg-transparent text-white text-xs focus:outline-none appearance-none cursor-pointer pr-6 font-medium [&>option]:bg-zinc-950 [&>option]:text-white"
                        >
                            {options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3.5 pointer-events-none text-zinc-500 group-hover/select:text-zinc-300 transition-colors">
                            <LucideChevronDown size={13} />
                        </div>
                    </div>
                </div>
            )}
        />
    )
}

// ─── CardHeader (helper reutilizable para headers de cards con icono) ──────────

export function CardHeader({ icon: Icon, title, desc, iconColor = "text-zinc-400" }: {
    icon: React.ElementType
    title: string
    desc?: string
    iconColor?: string
}) {
    return (
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.04] space-y-3">
            <div className="flex items-center gap-3">
                <div className={cn(
                    "w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center",
                    iconColor
                )}>
                    <Icon size={15} />
                </div>
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">{title}</h3>
            </div>
            {desc && <p className="text-xs text-zinc-600 leading-relaxed font-medium">{desc}</p>}
        </div>
    )
}

// ─── DangerRow (helper para filas de zona de peligro) ────────────────────────

export function DangerRow({ title, desc, buttonLabel, onClick }: {
    title: string
    desc: string
    buttonLabel: string
    onClick: () => void
}) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4 border-b border-white/[0.03] last:border-0">
            <div className="space-y-0.5">
                <h4 className="text-sm font-semibold text-white/90">{title}</h4>
                <p className="text-xs text-zinc-600 leading-relaxed">{desc}</p>
            </div>
            <button
                type="button"
                onClick={onClick}
                className="px-4 py-2 border border-red-900/40 hover:border-red-700/50 bg-red-500/[0.04] hover:bg-red-500/10 text-red-500/80 hover:text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 shrink-0"
            >
                {buttonLabel}
            </button>
        </div>
    )
}
