import { memo, useState, useMemo, useCallback } from 'react';
import { Play } from 'lucide-react';
import { DeferredImage } from '@/components/shared/deferred-image';
import { cn } from '@/components/ui/core/styling';
import { getSpineConfig } from '@/lib/helpers/goku-panorama';
import { getHighResImage, getMediumResImage } from '@/lib/helpers/images';

export interface SeriesItem {
    id: number
    title: string
    eps: number
    year: string | number
    progress: number
    img: string
    poster: string
    desc: string
    seriesId?: string
}

// Capas de profundidad centralizadas (evita números mágicos repetidos en el JSX)
const Z = {
    backdrop: 0,
    tint: 1,
    vignette: 2,
    sideShadow: 3,
    sideGradient: 4,
    glow: 4,
    character: 5,
    sheen: 6,
    border: 7,
    content: 8,
} as const;

export const getVhsColor = (id: number) => {
    const colors = ['#d96c14', '#b51f1f', '#2980b9', '#1a5c2e', '#1a4a8a', '#8e44ad', '#0e6655'];
    return colors[id % colors.length];
};

export const SeriesCard = memo(function SeriesCard({
    item,
    isSelected,
    onNavigate,
    onSelect,
    onSound,
}: {
    item: SeriesItem
    isSelected: boolean
    onNavigate: (id: string) => void
    onSelect: (id: number) => void
    onSound?: () => void
}) {
    const spineCfg = getSpineConfig(item.seriesId || "", item.id);
    const [isHovered, setIsHovered] = useState(false);

    const backdropSrc = useMemo(() =>
        getHighResImage(item.img || item.poster),
    [item.img, item.poster]);

    const posterSrc = useMemo(() =>
        getMediumResImage(item.poster || item.img),
    [item.poster, item.img]);

    const eraGradientFrom = spineCfg.colors[0];
    const eraGradientMid = spineCfg.colors[1];
    const eraGradientTo = spineCfg.colors[2];
    const eraAccent = spineCfg.accent;
    const characterSrc = spineCfg.rawImg;

    const itemIdStr = item?.id?.toString() || "";

    const handleActivate = useCallback(() => {
        if (isSelected) {
            onNavigate(itemIdStr);
        } else {
            onSelect(item.id);
            onSound?.();
        }
    }, [isSelected, itemIdStr, item.id, onNavigate, onSelect, onSound]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleActivate();
        }
    }, [handleActivate]);

    // Solo activa el hover en dispositivos que realmente soportan hover (evita el "hover pegado" en touch)
    const handleMouseEnter = useCallback(() => {
        if (typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches) {
            setIsHovered(true);
        }
    }, []);
    const handleMouseLeave = useCallback(() => setIsHovered(false), []);

    // --- Estilos memoizados (evitan recrear strings de gradiente en cada render) ---

    const containerStyle = useMemo<React.CSSProperties>(() => ({
        flex: isSelected ? '3.8 0 560px' : isHovered ? '1.6 1 230px' : '1 1 160px',
        transition: 'flex 800ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: "flex, transform",
    }), [isSelected, isHovered]);

    const tintStyle = useMemo<React.CSSProperties>(() => ({
        background: isSelected
            ? `linear-gradient(90deg, ${eraGradientTo}f2 0%, ${eraGradientMid}cc 34%, ${eraGradientFrom}44 68%, rgba(0,0,0,0.22) 100%)`
            : `linear-gradient(180deg, ${eraGradientFrom}ea 0%, ${eraGradientMid}dd 48%, ${eraGradientTo}f8 100%)`,
        mixBlendMode: "multiply",
    }), [isSelected, eraGradientFrom, eraGradientMid, eraGradientTo]);

    const vignetteStyle = useMemo<React.CSSProperties>(() => ({
        background: isSelected
            ? "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.2) 100%)"
            : "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 30%, transparent 60%)",
    }), [isSelected]);

    const sideGradientStyle = useMemo<React.CSSProperties>(() => ({
        background: `linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,0.3) 70%, transparent 100%)`,
    }), []);

    const glowStyle = useMemo<React.CSSProperties>(() => {
        const auraColor = (item.seriesId === "dragon_ball_daima" || eraAccent === "#ffffff") ? eraGradientFrom : (eraAccent || eraGradientFrom);
        return {
            background: `radial-gradient(circle, ${auraColor} 0%, transparent 70%)`,
        };
    }, [eraAccent, eraGradientFrom, item.seriesId]);

    const leftBorderStyle = useMemo<React.CSSProperties>(() => ({
        background: `linear-gradient(to bottom, ${eraGradientFrom}, ${eraGradientTo})`,
        boxShadow: `0 0 12px ${eraGradientFrom}50`,
    }), [eraGradientFrom, eraGradientTo]);

    const epsBadgeStyle = useMemo<React.CSSProperties>(() => ({
        backgroundColor: `${eraGradientFrom}20`,
        color: eraGradientFrom,
        border: `1px solid ${eraGradientFrom}30`,
    }), [eraGradientFrom]);

    const progressBarCollapsedStyle = useMemo<React.CSSProperties>(() => ({
        width: `${item.progress}%`,
        backgroundColor: eraAccent,
        boxShadow: `0 0 8px ${eraAccent}60`,
    }), [item.progress, eraAccent]);

    const progressBarExpandedStyle = useMemo<React.CSSProperties>(() => ({
        width: `${item.progress}%`,
        background: `linear-gradient(to right, ${eraGradientFrom}, ${eraAccent})`,
        boxShadow: `0 0 10px ${eraGradientFrom}60`,
    }), [item.progress, eraGradientFrom, eraAccent]);

    const posterGlowStyle = useMemo<React.CSSProperties>(() => ({
        backgroundColor: eraAccent,
    }), [eraAccent]);

    const serieTagStyle = useMemo<React.CSSProperties>(() => ({
        backgroundColor: `${eraGradientFrom}20`,
        color: eraGradientFrom,
        border: `1px solid ${eraGradientFrom}40`,
    }), [eraGradientFrom]);

    const playButtonStyle = useMemo<React.CSSProperties>(() => ({
        background: `linear-gradient(135deg, ${eraGradientTo}, ${eraGradientFrom})`,
        borderColor: `${eraGradientFrom}50`,
        boxShadow: `0 8px 24px ${eraGradientFrom}40`,
    }), [eraGradientTo, eraGradientFrom]);

    const progressColorStyle = useMemo<React.CSSProperties>(() => ({
        color: eraAccent,
    }), [eraAccent]);

    return (
        <div
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`${item.title}, ${item.year}, ${item.eps} episodios, ${item.progress}% visto`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleActivate}
            onKeyDown={handleKeyDown}
            style={containerStyle}
            className={cn(
                "h-full min-w-[120px] flex flex-col cursor-pointer overflow-hidden relative group/card select-none rounded-none",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70",
                !isSelected && "hover:-translate-y-1.5 hover:z-30"
            )}
        >
            {/* Contenedor de imagen con overlay */}
            <div className="absolute inset-0 bg-zinc-950" style={{ zIndex: Z.backdrop }}>
                <DeferredImage
                    src={backdropSrc || posterSrc}
                    alt={item.title}
                    priority={isSelected}
                    className={cn(
                        "absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-out transform-gpu",
                        isSelected
                            ? "scale-[1.04] opacity-70 group-hover/card:scale-[1.08]"
                            : "scale-[1.16] opacity-[0.05] blur-[2px] group-hover/card:scale-[1.22] group-hover/card:opacity-[0.08]"
                    )}
                />
            </div>

            <div
                className="absolute inset-0 transition-opacity duration-700"
                style={{ ...tintStyle, zIndex: Z.tint }}
            />

            <div
                className={cn(
                    "absolute inset-0 transition-opacity duration-700",
                    isSelected ? "opacity-95" : "opacity-60"
                )}
                style={{ ...vignetteStyle, zIndex: Z.vignette }}
            />

            <div className="absolute inset-y-0 left-0 w-px bg-white/20 shadow-[0_0_18px_rgba(255,255,255,0.18)]" style={{ zIndex: Z.sideShadow }} />
            <div className="absolute inset-y-0 right-0 w-px bg-black/50" style={{ zIndex: Z.sideShadow }} />

            {/* Gradiente lateral en expandido */}
            <div
                className={cn(
                    "absolute inset-0 pointer-events-none transition-opacity duration-700",
                    isSelected ? "opacity-100" : "opacity-0"
                )}
                style={{ ...sideGradientStyle, zIndex: Z.sideGradient }}
            />

            {/* Aura de resplandor radial detrás del personaje (suave desvanecimiento) */}
            <div
                className={cn(
                    "absolute bottom-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-700 group-hover/card:scale-125",
                    isSelected ? "opacity-0 scale-75" : "opacity-35 group-hover/card:opacity-55"
                )}
                style={{ ...glowStyle, zIndex: Z.glow }}
            />

            {/* Personaje Goku con posicionamiento uniforme para transición suave */}
            <img
                src={characterSrc}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{ zIndex: Z.character }}
                className={cn(
                    "pointer-events-none absolute bottom-0 select-none object-contain drop-shadow-[0_20px_28px_rgba(0,0,0,0.78)] transition-all duration-1000 ease-out transform-gpu",
                    isSelected
                        ? "left-[88%] md:left-[90%] -translate-x-1/2 h-[96%] opacity-100 scale-100 group-hover/card:scale-[1.03]"
                        : "left-1/2 -translate-x-1/2 h-[82%] opacity-95 saturate-[1.12] scale-100 group-hover/card:h-[88%] group-hover/card:saturate-[1.25]"
                )}
            />

            {/* Glass sheen sweep en hover */}
            <div
                className={cn(
                    "absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-700",
                    "bg-gradient-to-r from-transparent via-white/[0.07] to-transparent -skew-x-12",
                    isHovered && !isSelected && "opacity-100"
                )}
                style={{ zIndex: Z.sheen }}
            />

            {/* Borde izquierdo con gradiente de era (solo colapsado) */}
            <div
                className={cn(
                    "absolute left-0 top-0 bottom-0 w-[3px] transition-opacity duration-700",
                    isSelected ? "opacity-0" : "opacity-100"
                )}
                style={{ ...leftBorderStyle, zIndex: Z.border }}
            />

            {/* ─── CONTENIDO COLAPSADO ─── */}
            <div 
                className={cn(
                    "absolute inset-0 transition-all duration-700 ease-out pointer-events-none select-none",
                    isSelected ? "opacity-0 scale-95 translate-y-4" : "opacity-100 scale-100 translate-y-0"
                )}
                style={{ zIndex: Z.content }}
            >
                {/* Badge de episodios */}
                <div className="absolute top-3 right-3 pointer-events-auto">
                    <span
                        className="text-[10px] font-black tracking-wider px-2 py-1 rounded-md backdrop-blur-md inline-block"
                        style={epsBadgeStyle}
                    >
                        {item.eps} eps
                    </span>
                </div>

                {/* Título en la parte inferior */}
                <div className="absolute bottom-7 left-0 right-0 px-3">
                    <h3
                        className="font-bebas text-base tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] leading-tight line-clamp-2"
                    >
                        {item.title}
                    </h3>
                    <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">
                        {item.year}
                    </span>
                </div>

                {/* Barra de progreso delgada */}
                <div
                    className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/60"
                    role="progressbar"
                    aria-valuenow={item.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progreso de visualización"
                >
                    <div
                        className="h-full transition-all duration-1000 ease-out"
                        style={progressBarCollapsedStyle}
                    />
                </div>
            </div>

            {/* ─── CONTENIDO EXPANDIDO ─── */}
            <div 
                className={cn(
                    "absolute inset-0 flex flex-row items-center p-6 md:p-8 gap-6 w-full h-full select-none transition-all duration-700 ease-out",
                    isSelected ? "opacity-100 pointer-events-auto translate-x-0" : "opacity-0 pointer-events-none -translate-x-6"
                )} 
                style={{ zIndex: Z.content }}
            >
                {/* Columna Izquierda: Portada Grande */}
                <div 
                    className={cn(
                        "relative group/poster shrink-0 transition-all duration-700 ease-out",
                        isSelected ? "opacity-100 w-[120px] md:w-[150px] scale-100" : "opacity-0 w-0 scale-90"
                    )}
                >
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-white/10 via-transparent to-white/5 opacity-50 blur-[2px]" />
                    <DeferredImage
                        src={posterSrc}
                        alt={item.title}
                        className="relative w-full aspect-[2/3] object-cover rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.85)] border border-white/15 transition-all duration-700 group-hover/poster:scale-[1.03] group-hover/poster:border-white/20"
                    />
                    {/* Glow de la era abajo de la portada */}
                    <div
                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[80%] h-4 blur-md opacity-60 rounded-full"
                        style={posterGlowStyle}
                    />
                </div>

                {/* Columna Derecha: Detalles */}
                <div 
                    className={cn(
                        "flex flex-col justify-center flex-1 min-w-0 transition-all duration-700 ease-out delay-100",
                        isSelected ? "opacity-100 max-w-[42%] sm:max-w-[44%] md:max-w-[46%] translate-x-0" : "opacity-0 max-w-0 -translate-x-4"
                    )}
                >
                    {/* Tag de serie con color de era */}
                    <div className="flex items-center gap-2 mb-2 shrink-0">
                        <span
                            className="text-[9px] font-black tracking-[0.2em] uppercase px-2.5 py-0.5 rounded"
                            style={serieTagStyle}
                        >
                            Serie
                        </span>
                        <span className="text-[9px] font-black tracking-widest text-white/40">
                            {item.year}
                        </span>
                        <span className="text-white/30">·</span>
                        <span className="text-[9px] font-black tracking-widest text-white/40">
                            {item.eps} episodios
                        </span>
                    </div>

                    {/* Título principal */}
                    <h2
                        className="font-bebas text-2xl md:text-4xl tracking-tight text-white leading-tight mb-2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] line-clamp-2"
                    >
                        {item.title}
                    </h2>

                    {/* Sinopsis */}
                    <p className="text-xs md:text-sm text-white/70 line-clamp-3 mb-4 leading-relaxed font-medium">
                        {item.desc}
                    </p>

                    {/* Barra de progreso detallada */}
                    <div className="flex flex-col mb-4 w-full max-w-xs shrink-0">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/30">
                                Progreso de visualización
                            </span>
                            <span
                                className="text-[9px] font-black"
                                style={progressColorStyle}
                            >
                                {item.progress}%
                            </span>
                        </div>
                        <div
                            className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden border border-white/5"
                            role="progressbar"
                            aria-valuenow={item.progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div
                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                style={progressBarExpandedStyle}
                            />
                        </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            type="button"
                            aria-label={`Reproducir ${item.title}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onNavigate(itemIdStr);
                            }}
                            className="group/btn relative flex items-center gap-3 px-5 py-2.5 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.03] active:scale-95 border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                            style={playButtonStyle}
                        >
                            {/* Shine sweep */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
                            <Play className="w-3.5 h-3.5 fill-current relative z-10" aria-hidden="true" />
                            <span className="text-[10px] font-black tracking-[0.15em] uppercase relative z-10">
                                Reproducir
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});