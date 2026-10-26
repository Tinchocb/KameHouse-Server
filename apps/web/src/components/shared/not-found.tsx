import { ButtonAnatomy } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { Link } from "@tanstack/react-router"

export function NotFound() {
    return (
        <div className="sectionbar flex flex-col items-center justify-center min-h-[360px] max-w-lg mx-auto my-12 p-8 md:p-12 text-center animate-slide-up">
            <h2 className="text-3xl md:text-4xl font-display tracking-tight text-on-surface mb-4 text-balance">
                Página no encontrada
            </h2>
            <p className="text-on-surface-variant mb-8 leading-relaxed text-sm max-w-md font-medium text-pretty">
                El módulo que buscas no existe en este sector del universo.
            </p>
            {/* Un solo control: el enlace lleva la receta de Button (antes <a><button>, dos paradas de Tab). */}
            <Link
                to="/home"
                className={cn(
                    ButtonAnatomy.root({ intent: "primary", size: "lg" }),
                    "transition-[transform,background-color,border-color,color,box-shadow,filter] duration-fast ease-out-strong active:scale-95",
                )}
            >
                Volver al inicio
            </Link>
        </div>
    )
}
