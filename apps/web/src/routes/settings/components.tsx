import React from "react"
import { cn } from "@/components/ui/core/styling"
import { LucideRefreshCw, LucideCloud, LucidePlus, LucideTrash2, LucideFolder, LucideEye, LucideEyeOff, LucideChevronDown } from "lucide-react"
import { Controller, type Control, type Path, type FieldValues } from "react-hook-form"
import { Switch } from "@/components/ui/switch"

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
                    ? "bg-brand-orange/5 border-brand-orange/10 hover:bg-brand-orange/10 hover:border-brand-orange/20 text-brand-orange shadow-[0_0_30px_rgba(235,94,40,0.02)]" 
                    : "bg-white/[0.01] border-white/5 hover:bg-white/[0.04] hover:border-white/10 text-white shadow-sm",
                loading && "opacity-50 cursor-not-allowed"
            )}
        >
            <div className="text-left relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-40 mb-1 group-hover/scanbtn:opacity-60 transition-opacity">
                    {isDelta ? "Rápido" : "Profundo"}
                </p>
                <p className="text-xl font-bebas tracking-wider uppercase">{isDelta ? "Escaneo Delta" : "Escaneo Completo"}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center group-hover/scanbtn:bg-white/5 transition-colors">
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

export function IntegrationCard({ name, status, connected, disabled }: { name: string; status: string; connected: boolean; disabled?: boolean }) {
    return (
        <div className={cn(
            "p-6 border rounded-2xl bg-card/20 backdrop-blur-md flex items-center justify-between transition-all duration-500 relative overflow-hidden group/intcard",
            disabled 
                ? "opacity-30 grayscale border-white/5" 
                : "border-white/5 hover:border-white/10 hover:bg-white/[0.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.01)]"
        )}>
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover/intcard:bg-white/[0.05] transition-colors duration-500">
                    <LucideCloud size={20} className={cn("transition-colors duration-500", connected ? "text-brand-orange" : "text-zinc-500 group-hover/intcard:text-zinc-300")} />
                </div>
                <div className="text-left">
                    <p className="font-bebas text-2xl tracking-wider uppercase text-white/90 group-hover/intcard:text-white transition-colors">{name}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">{status}</p>
                </div>
            </div>
            
            {connected && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-[9px] font-black tracking-widest uppercase text-emerald-400">CONECTADO</span>
                </div>
            )}
            
            {!connected && !disabled && (
                <span className="text-[9px] font-black tracking-widest uppercase text-zinc-500 border border-zinc-800/80 px-3 py-1 rounded-full group-hover/intcard:border-zinc-700/80 group-hover/intcard:text-zinc-400 transition-colors">
                    DISPONIBLE
                </span>
            )}
            
            {disabled && (
                <span className="text-[9px] font-black tracking-widest uppercase text-zinc-600 border border-zinc-900 px-3 py-1 rounded-full">
                    PRÓXIMAMENTE
                </span>
            )}
        </div>
    )
}

export function StatusCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
    return (
        <div className="p-6 border border-white/5 bg-card/20 backdrop-blur-md rounded-2xl flex items-center gap-5 transition-all duration-500 hover:bg-white/[0.01] hover:border-white/10 group/statuscard">
            <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-zinc-500 group-hover/statuscard:text-zinc-300 transition-all">
                <Icon size={20} />
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-0.5">{label}</p>
                <p className="text-2xl font-bebas tracking-wider uppercase text-white/90 group-hover/statuscard:text-white transition-colors">{value}</p>
            </div>
        </div>
    )
}

export function Section({ label, children, right }: { label: string; children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div className="space-y-6 w-full">
            <div className="flex items-center justify-between px-1">
                 <div className="flex items-center gap-3">
                    <div className="h-3 w-[3px] rounded-full bg-brand-orange/70" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">{label}</p>
                </div>
                {right}
            </div>
            {children}
        </div>
    )
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
         <div className={cn(
            "overflow-hidden bg-card/20 backdrop-blur-md border border-white/[0.04] rounded-2xl",
            "transition-all duration-500 hover:bg-card/25 hover:border-white/10 hover:shadow-[0_0_40px_rgba(0,0,0,0.2)]",
            className
        )}>
            {children}
        </div>
    )
}

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
                    "flex items-center justify-between px-6 py-5 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.01] transition-all duration-300 gap-10 group/toggle",
                    disabled && "opacity-40 cursor-not-allowed pointer-events-none"
                )}>
                    <div className="space-y-1 flex-1">
                        <p className="text-base font-bold text-zinc-100 group-hover/toggle:text-white transition-colors tracking-tight">{label}</p>
                        {desc && <p className="text-xs text-zinc-500 leading-relaxed font-medium">{desc}</p>}
                    </div>
                    <Switch
                        value={!!field.value}
                        onValueChange={(v: boolean) => {
                            if (disabled) return
                            field.onChange(v)
                            onSave?.()
                        }}
                        disabled={disabled}
                        className="scale-110 origin-right transition-all duration-300 data-[state=checked]:bg-brand-orange"
                    />
                </div>
            )}
        />
    )
}

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
                    <div className="p-8 space-y-6 group/pathlist">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center group-hover/pathlist:bg-white/5 transition-colors">
                                    <LucideFolder size={14} className="text-zinc-500 group-hover/pathlist:text-zinc-300 transition-colors" />
                                </div>
                                <p className="text-2xl font-bebas tracking-wider text-white uppercase">{label}</p>
                            </div>
                            <p className="text-xs text-zinc-500 font-medium leading-relaxed max-w-xl">
                                Directorios locales vinculados a este motor de búsqueda. El escáner analizará estos directorios de forma recursiva.
                            </p>
                        </div>

                        {/* List of paths */}
                        <div className="space-y-2.5">
                            {paths.length === 0 ? (
                                <div className="border border-dashed border-white/5 bg-white/[0.005] p-8 rounded-xl text-center space-y-1.5">
                                    <p className="text-zinc-600 text-xs font-medium italic">No se han configurado directorios.</p>
                                    <p className="text-zinc-700 text-[10px] uppercase tracking-[0.2em]">Usa el campo de abajo para agregar uno</p>
                                </div>
                            ) : (
                                paths.map((path: string, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between bg-white/[0.01] border border-white/5 px-5 py-3.5 rounded-xl hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300 group/pathitem">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-orange/40 group-hover/pathitem:bg-brand-orange transition-colors shrink-0" />
                                            <span className="font-mono text-xs text-zinc-400 truncate group-hover/pathitem:text-zinc-200 transition-colors tracking-tight">{path}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(idx)}
                                            className="text-zinc-600 hover:text-white p-2 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/10 transition-all ml-3 shrink-0"
                                        >
                                            <LucideTrash2 size={15} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Input to add path */}
                        <div className="flex gap-2.5 p-1.5 bg-black/40 border border-white/5 focus-within:border-white/10 rounded-xl transition-all focus-within:shadow-[0_0_20px_rgba(255,255,255,0.01)]">
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
                                className="flex-1 bg-transparent px-4 py-2 text-white placeholder-zinc-700 text-xs font-mono focus:outline-none transition-all"
                            />
                            <button
                                type="button"
                                onClick={handleAdd}
                                className="bg-white hover:bg-zinc-200 text-black px-6 py-2 rounded-lg font-black uppercase text-[9px] tracking-[0.2em] transition-all shrink-0 flex items-center gap-2 active:scale-95"
                            >
                                <LucidePlus size={14} />
                                AGREGAR
                            </button>
                        </div>
                    </div>
                )
            }}
        />
    )
}

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
                <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-5 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.01] transition-all duration-300 gap-6 group/input">
                    <div className="space-y-1 flex-1 max-w-xl">
                        <p className="text-base font-bold text-zinc-100 group-hover/input:text-white transition-colors tracking-tight">{label}</p>
                        {desc && <p className="text-xs text-zinc-500 leading-relaxed font-medium">{desc}</p>}
                    </div>
                    <div className={cn(
                        "flex items-center gap-3 bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 w-full md:w-80 transition-all relative",
                        "focus-within:border-brand-orange/20 focus-within:shadow-[0_0_20px_rgba(235,94,40,0.05)] hover:border-white/10"
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
                                "flex-1 bg-transparent text-white placeholder-zinc-800 text-xs focus:outline-none transition-all pr-6",
                                isMono && "font-mono text-[11px] tracking-tight"
                            )}
                        />
                        {isSecure && (
                            <button
                                type="button"
                                onClick={() => setShowSecure(!showSecure)}
                                className="absolute right-4 text-zinc-600 hover:text-white transition-colors"
                            >
                                {showSecure ? <LucideEyeOff size={14} /> : <LucideEye size={14} />}
                            </button>
                        )}
                    </div>
                </div>
            )}
        />
    )
}

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
                <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-5 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.01] transition-all duration-300 gap-6 group/select">
                    <div className="space-y-1 flex-1 max-w-xl">
                        <p className="text-base font-bold text-zinc-100 group-hover/select:text-white transition-colors tracking-tight">{label}</p>
                        {desc && <p className="text-xs text-zinc-500 leading-relaxed font-medium">{desc}</p>}
                    </div>
                    <div className={cn(
                        "flex items-center gap-3 bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 w-full md:w-80 transition-all relative cursor-pointer",
                        "focus-within:border-brand-orange/20 focus-within:shadow-[0_0_20px_rgba(235,94,40,0.05)] hover:border-white/10"
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
                        <div className="absolute right-4 pointer-events-none text-zinc-600 group-hover/select:text-zinc-400 transition-colors">
                            <LucideChevronDown size={14} />
                        </div>
                    </div>
                </div>
            )}
        />
    )
}
