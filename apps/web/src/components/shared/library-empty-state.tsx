import { useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { SuggestionCards } from "./getting-started-steps/suggestion-cards"
import { EmptyState } from "./empty-state"

interface LibraryEmptyStateProps {
    title?: string
    message?: string
    // Tarjetas opcionales (motor, reproducción, idioma). Por defecto sólo en el
    // estado vacío "de bienvenida", sin título/mensaje propios.
    suggestions?: boolean
}

// Biblioteca sin contenido: guía al usuario a escanear sus carpetas y ofrece, sin
// bloquear, los ajustes opcionales que el onboarding ya no pregunta.
export function LibraryEmptyState({
    title,
    message,
    suggestions,
}: LibraryEmptyStateProps) {
    const navigate = useNavigate()
    const showSuggestions = suggestions ?? (title === undefined && message === undefined)
    return (
        <div className="w-full flex flex-col items-center">
            <EmptyState
                headingLevel="h2"
                // Solo en la bienvenida (sin título propio): aquí el usuario tiene que actuar, escanear sus carpetas.
                icon={title === undefined ? (
                    <img
                        src="/illustrations/maintenance-character.png"
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        className="w-40 h-auto object-contain select-none pointer-events-none"
                    />
                ) : undefined}
                title={title ?? "Tu biblioteca está vacía"}
                message={message ?? "Todavía no hay contenido para mostrar. Escanea tus carpetas desde Ajustes para empezar."}
                action={
                    <Button intent="primary" size="lg" onClick={() => navigate({ to: "/settings", search: { tab: "library" } })}>
                        Escanear biblioteca
                    </Button>
                }
            />
            {showSuggestions && <SuggestionCards />}
        </div>
    )
}
