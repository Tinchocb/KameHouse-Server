import { useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { IconStatusFolderOpen } from "@/components/ui/icons"
import { SuggestionCards } from "./getting-started-steps/suggestion-cards"
import { EmptyState } from "./empty-state"

interface LibraryEmptyStateProps {
    title?: string
    message?: string
}

// Biblioteca sin contenido: guía al usuario a escanear sus carpetas y ofrece, sin
// bloquear, los ajustes opcionales que el onboarding ya no pregunta.
export function LibraryEmptyState({
    title,
    message,
}: LibraryEmptyStateProps) {
    const navigate = useNavigate()
    const isWelcome = title === undefined && message === undefined
    const showSuggestions = isWelcome
    return (
        <div className="w-full flex flex-col items-center">
            <EmptyState
                headingLevel="h2"
                layout={isWelcome ? "horizontal" : "vertical"}
                iconContainer={!isWelcome}
                badge={isWelcome ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-3xs font-mono font-bold uppercase tracking-wider bg-brand-accent/15 border border-brand-accent/30 text-brand-accent-readable">
                        Primeros pasos
                    </span>
                ) : undefined}
                icon={isWelcome ? (
                    <div className="relative flex items-center justify-center p-1">
                        {/* Aura suave / foco ambiental detrás de Bulma */}
                        <div
                            aria-hidden="true"
                            className="absolute inset-0 rounded-full blur-3xl opacity-35 pointer-events-none scale-125 -z-10"
                            style={{
                                background: "radial-gradient(circle, color-mix(in srgb, var(--brand-accent-hex) 60%, white) 0%, transparent 70%)",
                            }}
                        />
                        <img
                            src="/illustrations/maintenance-character.png"
                            alt="Bulma señalando hacia los ajustes"
                            aria-hidden="true"
                            draggable={false}
                            className="w-auto h-56 sm:h-64 md:h-72 lg:h-80 max-h-80 object-contain select-none pointer-events-none drop-shadow-[0_16px_32px_rgba(0,0,0,0.5)] transition-transform duration-base motion-safe:hover:scale-[1.02]"
                        />
                    </div>
                ) : undefined}
                title={title ?? "Tu biblioteca está vacía"}
                message={message ?? "Todavía no hay contenido para mostrar. Escanea tus carpetas desde Ajustes para empezar."}
                action={
                    <Button
                        intent="primary"
                        size="lg"
                        onClick={() => navigate({ to: "/settings", search: { tab: "library" } })}
                        className="gap-2.5 shadow-brand-primary"
                    >
                        <IconStatusFolderOpen className="w-5 h-5 shrink-0" aria-hidden="true" />
                        <span>Escanear biblioteca</span>
                    </Button>
                }
            />
            {showSuggestions && <SuggestionCards />}
        </div>
    )
}
