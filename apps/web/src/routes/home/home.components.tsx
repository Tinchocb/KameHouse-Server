import { AlertTriangle, RefreshCcw, Database, Settings } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"
import { m } from "framer-motion"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"

/**
 * Banner shown when a library error occurs.
 */
export function ErrorBanner({ message }: { message: string }) {
    const entranceSpring = useSpringPreset("entrance")
    return (
        <div className="flex min-h-[100dvh] items-center justify-center -mt-20 px-4">
            <m.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={entranceSpring}
                className="w-full max-w-md glass-card rounded-3xl p-8 border border-[var(--glass-border-side)] text-center"
            >
                <div className="relative flex justify-center items-center w-16 h-16 mx-auto mb-4">
                    <div className="absolute inset-0 bg-brand-accent/20 rounded-full animate-ping" />
                    <AlertTriangle className="relative w-8 h-8 text-brand-accent" />
                </div>
                <h2 className="text-lg font-black uppercase tracking-wider text-on-surface mb-2">
                    CONEXIÓN INTERRUMPIDA
                </h2>
                <p className="text-sm text-on-surface-variant/70 mb-6 leading-relaxed">
                    {message}
                </p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-3 mx-auto px-8 py-3 rounded-full bg-brand-accent text-on-primary font-display tracking-widest active:scale-95 hover:brightness-110 transition-[transform,filter] duration-base ease-smooth-out shadow-brand-primary"
                    aria-label="Reintentar conexión"
                >
                    <RefreshCcw className="w-4 h-4" />
                    REINTENTAR ACCESO
                </button>
            </m.div>
        </div>
    )
}

/**
 * Shown when the library is empty.
 */
export function EmptyState() {
    const navigate = useNavigate()
    const entranceSpring = useSpringPreset("entrance")
    return (
        <div className="flex min-h-[100dvh] items-center justify-center -mt-20 px-4">
            <m.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={entranceSpring}
                className="w-full max-w-md glass-card rounded-3xl p-8 border border-[var(--glass-border-side)] text-center"
            >
                <div className="relative flex justify-center items-center w-24 h-24 mx-auto mb-4">
                    <div className="absolute inset-0 bg-brand-accent/10 rounded-full" />
                    <Database className="relative w-10 h-10 text-on-surface-variant" />
                </div>
                <h2 className="text-lg font-black uppercase tracking-wider text-on-surface mb-2">
                    BÓVEDA VACÍA
                </h2>
                <p className="text-sm text-on-surface-variant/70 mb-6 leading-relaxed max-w-xs mx-auto">
                    Aún no hay contenido listo para mostrar. Escanea tus rutas desde configuración para iniciar la sincronización.
                </p>
                <button
                    type="button"
                    onClick={() => navigate({ to: "/settings" })}
                    className="flex items-center gap-3 mx-auto px-8 py-3.5 rounded-full bg-brand-accent text-on-primary font-display tracking-widest text-sm active:scale-95 hover:brightness-110 transition-[transform,filter] duration-base ease-smooth-out shadow-brand-primary"
                    aria-label="Ir a Configuración"
                >
                    <Settings className="w-4 h-4" />
                    CONFIGURAR RUTAS
                </button>
            </m.div>
        </div>
    )
}