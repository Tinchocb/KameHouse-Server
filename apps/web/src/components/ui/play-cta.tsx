import { IconMediaPlay } from "@/components/ui/icons";
import { cn } from "./core/styling";
import { RippleFeedback } from "./kinetics";
import { ButtonAnatomy } from "./button/button";

interface PlayCtaProps {
    onClick: () => void;
    onHoverIntent?: () => void;
    label: string;
    sublabel?: string;
    className?: string;
    /**
     * Etiquetas que el botón puede alternar: se apilan invisibles en la misma celda que
     * la visible para reservar el ancho de la más larga. Sin esto, al volver del
     * reproductor "Reproducir" → "Continuar" achicaba la pastilla y corría la fila.
     */
    reserveLabels?: readonly string[];
}

const DEFAULT_RESERVE_LABELS = ["Reproducir", "Continuar"] as const;

export function PlayCta({ onClick, onHoverIntent, label, sublabel, className, reserveLabels = DEFAULT_RESERVE_LABELS }: PlayCtaProps) {
    return (
        // Un solo botón nativo: antes RippleFeedback (role="button") envolvía un
        // <button> y el teclado pasaba dos veces por el mismo CTA.
        <RippleFeedback
            onClick={onClick}
            onPointerEnter={onHoverIntent}
            onFocus={onHoverIntent}
            title={sublabel || label}
            rippleColor="color-mix(in srgb, currentColor 15%, transparent)"
            className={cn(
                ButtonAnatomy.root({ intent: "primary", size: "lg" }),
                "group/play gap-2.5 shrink-0 active:scale-95",
                className
            )}
        >
            {/* Shimmer light sweep */}
            <span aria-hidden="true" className="absolute inset-0 -translate-x-full [@media(hover:hover)_and_(pointer:fine)]:group-hover/play:translate-x-full transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover/play:transition-transform duration-slower ease-smooth-out bg-gradient-to-r from-transparent via-on-primary/10 to-transparent z-10 pointer-events-none rounded-full motion-reduce:hidden" />

            <IconMediaPlay size={15} fill="currentColor" className="shrink-0 transition-transform duration-quick ease-out-strong [@media(hover:hover)_and_(pointer:fine)]:group-hover/play:scale-105 relative z-20 translate-x-[1px]" />
            {/* Pila de grilla: todas en la misma celda, la visible encima. */}
            <span className="grid whitespace-nowrap relative z-20">
                {reserveLabels.map((reserved) => (
                    <span key={reserved} aria-hidden="true" className="invisible col-start-1 row-start-1">{reserved}</span>
                ))}
                <span className="col-start-1 row-start-1">{label}</span>
            </span>
        </RippleFeedback>
    );
}
