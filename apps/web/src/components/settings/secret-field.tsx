import React from "react"
import { IconUiEyeOff, IconUiEye } from "@/components/ui/icons";

export interface SecretFieldProps {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    id?: string
}

export function SecretField({ label, value, onChange, placeholder, id }: SecretFieldProps) {
    const [show, setShow] = React.useState(false)
    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={id} className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider font-mono">{label}</label>
            <div className="relative flex items-center">
                <input
                    id={id}
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    // text-base en mobile: iOS Safari hace zoom al enfocar cualquier
                    // input por debajo de 16px. El tamaño de desktop no cambia.
                    className="w-full bg-zinc-950/40 backdrop-blur-overlay-md hover:bg-zinc-900/50 border border-white/20 border-t-white/30 hover:border-white/30 focus:border-white/40 focus:ring-1 focus:ring-white/25 rounded-full px-4 py-2.5 pr-11 text-base md:text-xs text-on-surface placeholder:text-on-surface-variant/40 font-mono focus:outline-none transition-all shadow-glass-highlight-md"
                />
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-3 text-zinc-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
                >
                    {show ? <IconUiEyeOff className="w-4 h-4" /> : <IconUiEye className="w-4 h-4" />}
                </button>
            </div>
        </div>
    )
}
