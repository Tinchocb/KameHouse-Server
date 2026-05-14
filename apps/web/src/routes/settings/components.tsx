import React from "react"
import { cn } from "@/components/ui/core/styling"
import { LucideRefreshCw, LucideCloud, LucidePlus, LucideTrash2, LucideFolder } from "lucide-react"
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
                "flex-1 flex items-center justify-between p-6 rounded-none border transition-all duration-500",
                isDelta ? "bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary" : "bg-white/5 border-white/10 hover:bg-white/10 text-white",
                loading && "opacity-50 cursor-not-allowed"
            )}
        >
            <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">{isDelta ? "Rápido" : "Profundo"}</p>
                <p className="text-xl font-bebas tracking-widest uppercase">{isDelta ? "Escaneo Delta" : "Escaneo Completo"}</p>
            </div>
            <LucideRefreshCw size={24} className={cn(isDelta ? "text-primary" : "text-white", loading && "animate-spin")} />
        </button>
    )
}

export function IntegrationCard({ name, status, connected, disabled }: { name: string; status: string; connected: boolean; disabled?: boolean }) {
    return (
        <div className={cn(
            "p-8 border border-white/5 bg-white/[0.02] flex flex-col items-center text-center gap-4 transition-all duration-500",
            disabled ? "opacity-40 grayscale" : "hover:border-white/20 hover:bg-white/[0.05]"
        )}>
            <div className="w-16 h-16 bg-white/5 flex items-center justify-center">
                <LucideCloud size={32} className={connected ? "text-primary" : "text-zinc-500"} />
            </div>
            <div>
                <p className="font-bebas text-2xl tracking-widest uppercase">{name}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">{status}</p>
            </div>
        </div>
    )
}

export function StatusCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
    return (
        <div className="p-8 border border-white/5 bg-white/[0.02] flex items-center gap-6">
            <div className="w-12 h-12 bg-white/5 flex items-center justify-center text-zinc-400">
                <Icon size={24} />
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</p>
                <p className="text-xl font-bebas tracking-widest uppercase text-white">{value}</p>
            </div>
        </div>
    )
}

export function Section({ label, children, right }: { label: string; children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between px-2">
                 <div className="flex items-center gap-4">
                    <div className="h-px w-12 bg-white/20" />
                    <p className="text-sm font-black uppercase tracking-[0.4em] text-zinc-400">{label}</p>
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
            "overflow-hidden bg-white/[0.02] border border-white/5 rounded-none",
            "transition-all duration-700 hover:bg-white/[0.04] hover:border-white/10",
            className
        )}>
            {children}
        </div>
    )
}

export interface OsToggleProps {
    control: Control<FieldValues>
    name: Path<FieldValues>
    label: string
    desc?: string
    onSave?: () => void
}

export function OsToggle({ control, name, label, desc, onSave }: OsToggleProps) {
    return (
        <Controller
            control={control}
            name={name}
            render={({ field }) => (
                <div className="flex items-center justify-between px-8 py-8 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-all duration-500 gap-16 group/toggle">
                    <div className="space-y-2 focus-within:ring-0 flex-1">
                        <p className="text-xl font-bold text-zinc-100 tracking-tight group-hover/toggle:text-white transition-colors">{label}</p>
                        {desc && <p className="text-base text-zinc-500 leading-relaxed font-medium">{desc}</p>}
                    </div>
                    <Switch
                        value={!!field.value}
                        onValueChange={(v: boolean) => {
                            field.onChange(v)
                            onSave?.()
                        }}
                        className="scale-125 origin-right"
                    />
                </div>
            )}
        />
    )
}

export function PathList({ control, name, label, placeholder }: { control: Control<FieldValues>, name: Path<FieldValues>, label: string, placeholder?: string }) {
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
                    <div className="p-10 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.01] transition-all duration-700 space-y-10 group/pathlist">
                        <div className="space-y-3">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center">
                                    <LucideFolder size={18} className="text-zinc-500 group-hover/pathlist:text-white transition-colors" />
                                </div>
                                <p className="text-3xl font-bebas tracking-widest text-white uppercase">{label}</p>
                            </div>
                            <p className="text-sm text-zinc-500 font-medium leading-relaxed max-w-xl">
                                Directorios locales vinculados a este motor de búsqueda. El escáner analizará estos directorios de forma recursiva.
                            </p>
                        </div>

                        {/* List of paths */}
                        <div className="space-y-3">
                            {paths.length === 0 ? (
                                <div className="border border-dashed border-white/10 p-10 text-center space-y-2">
                                    <p className="text-zinc-600 text-sm font-medium italic">No se han configurado directorios.</p>
                                    <p className="text-zinc-700 text-xs uppercase tracking-widest">Utilizá el campo de abajo para agregar uno</p>
                                </div>
                            ) : (
                                paths.map((path: string, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between bg-white/[0.01] border border-white/5 px-8 py-6 rounded-none hover:bg-white/[0.04] hover:border-white/20 transition-all group/pathitem">
                                        <div className="flex items-center gap-6 min-w-0">
                                            <div className="w-2 h-2 bg-primary/40 group-hover/pathitem:bg-primary transition-colors" />
                                            <span className="font-mono text-sm text-zinc-400 truncate group-hover/pathitem:text-white transition-colors tracking-tight">{path}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(idx)}
                                            className="text-zinc-700 hover:text-white p-3 hover:bg-red-500/20 border border-transparent hover:border-red-500/20 transition-all ml-4 shrink-0"
                                        >
                                            <LucideTrash2 size={18} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Input to add path */}
                        <div className="flex gap-4 p-2 bg-white/5 border border-white/10 group-focus-within/pathlist:border-white/20 transition-all">
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
                                className="flex-1 bg-transparent px-6 py-4 text-white placeholder-zinc-700 text-sm font-mono focus:outline-none transition-all"
                            />
                            <button
                                type="button"
                                onClick={handleAdd}
                                className="bg-white text-black hover:bg-zinc-200 px-10 font-black uppercase text-[10px] tracking-[0.2em] transition-all shrink-0 flex items-center gap-3"
                            >
                                <LucidePlus size={18} />
                                AGREGAR RUTA
                            </button>
                        </div>
                    </div>
                )
            }}
        />
    )
}

