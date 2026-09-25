interface PlayerFallbackProps {
    /** Qué se está por reproducir ("Preparando Cap. 21"). Sin texto queda solo el spinner. */
    label?: string
    /** Línea secundaria: serie o momento. */
    sublabel?: string
}

/**
 * Pantalla negra de carga del reproductor. También cubre el viaje cronología → serie →
 * reproductor, así toda la transición se ve como una sola pantalla en vez de mostrar
 * de paso la ficha de la serie.
 */
export function PlayerFallback({ label, sublabel }: PlayerFallbackProps = {}) {
    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed inset-0 bg-black flex flex-col justify-center items-center gap-5 z-player"
        >
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-secondary"></div>
            {label && (
                <div className="flex flex-col items-center gap-1 px-6 text-center">
                    <span className="font-display font-bold text-sm uppercase tracking-wider text-white">{label}</span>
                    {sublabel && <span className="text-xs text-white/55 max-w-md line-clamp-2">{sublabel}</span>}
                </div>
            )}
            {!label && <span className="sr-only">Cargando reproductor</span>}
        </div>
    );
}
