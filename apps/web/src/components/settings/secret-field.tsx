import React from "react"
import { m, AnimatePresence } from "framer-motion"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"
import { IconUiEyeOff, IconUiEye } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/button"

interface SecretFieldProps {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    id?: string
}

export function SecretField({ label, value, onChange, placeholder, id: idProp }: SecretFieldProps) {
    // Sin id el <label htmlFor> quedaba huérfano y el campo sin nombre accesible.
    const autoId = React.useId()
    const id = idProp ?? autoId
    const [show, setShow] = React.useState(false)
    const iconSwapSpring = useSpringPreset("press")
    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={id} className="text-xs font-semibold text-label-2">{label}</label>
            <div className="relative flex items-center">
                <input
                    id={id}
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    // text-base en mobile: iOS Safari hace zoom al enfocar cualquier
                    // input por debajo de 16px. El tamaño de desktop no cambia.
                    className="w-full bg-[var(--neutral-elev-2)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)] border border-[var(--neutral-separator)] focus-visible:ring-2 focus-visible:ring-brand-accent rounded-full px-4 py-2.5 pr-12 min-h-11 text-base md:text-xs text-on-surface placeholder:text-label-3 font-mono focus:outline-none transition-[background-color] duration-fast ease-smooth-out"
                />
                <IconButton
                    intent="ghost"
                    size="sm"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Ocultar la clave" : "Mostrar la clave"}
                    className="absolute right-1.5 text-label-2 [@media(hover:hover)_and_(pointer:fine)]:hover:text-label-1"
                    icon={
                        <AnimatePresence mode="wait" initial={false}>
                            <m.span
                                key={show ? "hide" : "show"}
                                initial={{ opacity: 0, scale: 0.6 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.6 }}
                                transition={iconSwapSpring}
                                className="flex"
                            >
                                {show ? <IconUiEyeOff className="w-4 h-4" /> : <IconUiEye className="w-4 h-4" />}
                            </m.span>
                        </AnimatePresence>
                    }
                />
            </div>
        </div>
    )
}
