import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/components/ui/core/styling';
import { IconStatusImageOff } from "@/components/ui/icons";
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from '@/lib/hardware/performance-store';
import { isImageLoaded, markImageLoaded, isTmdbImageUrl, withTmdbSize, localImage, supportsAnonymousCors } from '@/lib/helpers/images';

interface DeferredImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "onDrag"> {
    src: string;
    alt: string;
    lowResSrc?: string;
    placeholderColor?: string;
    rootMargin?: string;
    threshold?: number | number[];
    priority?: boolean;
    showSkeleton?: boolean;
    fallback?: React.ReactNode;
    imgClassName?: string;
    timeoutMs?: number;
    sizes?: string;
    srcSet?: string;
    fetchPriority?: "high" | "low" | "auto";
    /** Aplicado a la imagen y al LQIP (punto focal de los heroes). */
    objectPosition?: string;
}

const isDirectTmdbUrl = (url: string) => /^https?:\/\/image\.tmdb\.org\//.test(url);

function getTmdbSrcSet(url: string): string | undefined {
    if (!url || !isTmdbImageUrl(url)) {
        return undefined;
    }
    // Por el proxy local: el servidor las guarda en disco y el navegador las cachea
    // como inmutables (directo a TMDB, el SW no puede guardar respuestas opacas).
    return [185, 342, 500, 780, 1280].map((w) => `${localImage(withTmdbSize(url, `w${w}`))} ${w}w`).join(", ");
}

/**
 * srcSet que DeferredImage arma por su cuenta para un `src` (sin `srcSet` explícito).
 * Sirve para precargar exactamente la variante que después pedirá el `<img>`.
 */
export function getDeferredImageSrcSet(rawSrc: string): string | undefined {
    return isDirectTmdbUrl(rawSrc) ? getTmdbSrcSet(rawSrc) : undefined;
}

/**
 * srcSet para heroes a pantalla completa: arranca en w780 y llega a `original`
 * (los backdrops de TMDB son ≥1920 de ancho), así en 1440p/4K no se estira w1280.
 */
export function getTmdbHeroSrcSet(url: string): string | undefined {
    if (!url || !isTmdbImageUrl(url)) {
        return undefined;
    }
    const size = (s: string) => localImage(withTmdbSize(url, s));
    return `${size("w780")} 780w, ${size("w1280")} 1280w, ${size("original")} 1920w`;
}

const observers = new Map<string, IntersectionObserver>();
const observerCallbacks = new WeakMap<Element, () => void>();

function getObserver(rootMargin: string, threshold: string): IntersectionObserver {
    const key = `${rootMargin}_${threshold}`;
    let observer = observers.get(key);
    if (!observer) {
        const thresholdVal = threshold.includes(',') 
            ? threshold.split(',').map(Number) 
            : Number(threshold);
            
        observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const callback = observerCallbacks.get(entry.target);
                        if (callback) {
                            callback();
                            observerCallbacks.delete(entry.target);
                            observer?.unobserve(entry.target);
                        }
                    }
                });
            },
            { rootMargin, threshold: thresholdVal }
        );
        observers.set(key, observer);
    }
    return observer;
}

export function DeferredImage(props: DeferredImageProps) {
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed);
    const defaultRootMargin = isHeavyAllowed ? '400px' : '100px';

    const {
        src: rawSrc,
        alt,
        lowResSrc: rawLowResSrc,
        className,
        placeholderColor = 'rgba(24, 24, 27, 0.6)',
        rootMargin = defaultRootMargin,
        threshold = 0,
        priority = false,
        showSkeleton = true,
        fallback,
        imgClassName,
        timeoutMs = 10000,
        sizes,
        srcSet,
        crossOrigin,
        fetchPriority,
        loading,
        decoding,
        objectPosition,
        style,
        onLoad,
        onError,
        ...restProps
    } = props;

    // Las de TMDB se piden siempre por el proxy local (idempotente si ya vienen de él).
    const src = localImage(rawSrc);
    const lowResSrc = rawLowResSrc ? localImage(rawLowResSrc) : rawLowResSrc;
    const resolvedCrossOrigin = crossOrigin ?? (supportsAnonymousCors(src) ? "anonymous" : undefined);

    const [isIntersecting, setIsIntersecting] = useState(priority);
    // Si la URL ya terminó de descargarse antes (rotación o prewarm), no
    // flashear el skeleton: arrancar como cargada sin fundido lento.
    const [isLoaded, setIsLoaded] = useState(() => isImageLoaded(src));
    const [skipFade, setSkipFade] = useState(() => isImageLoaded(src));
    // El skeleton (y con él el placeholderColor) se va recién cuando la imagen terminó de
    // fundirse encima; si se desmontaba al cargar, durante el fundido asomaba el
    // fondo del padre (claro → hueco → imagen).
    const [isSkeletonGone, setIsSkeletonGone] = useState(() => isImageLoaded(src));
    const [isLowResLoaded, setIsLowResLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [showLqip, setShowLqip] = useState(Boolean(priority && lowResSrc));

    const containerRef = useRef<HTMLDivElement>(null);
    const thresholdStr = Array.isArray(threshold) ? threshold.join(',') : String(threshold);

    const lqipSrc = lowResSrc;
    // Solo se ofrecen otros anchos si llega la URL directa de TMDB. Una que ya viene del proxy
    // la dimensionó quien llama (p. ej. el póster w342 de una tarjeta): reabrirla hasta w1280
    // bajaba y decodificaba imágenes 5 veces más pesadas que lo que se dibuja.
    const computedSrcSet = srcSet ?? (isDirectTmdbUrl(rawSrc) ? getTmdbSrcSet(rawSrc) : undefined);
    const computedSizes = sizes ?? (computedSrcSet ? '(max-width: 640px) 185px, (max-width: 1024px) 342px, 500px' : undefined);

    const [prevProps, setPrevProps] = useState({ src, priority, lqipSrc });
    if (src !== prevProps.src || priority !== prevProps.priority || lqipSrc !== prevProps.lqipSrc) {
        setPrevProps({ src, priority, lqipSrc });
        setIsIntersecting(priority);
        const alreadyLoaded = isImageLoaded(src);
        setIsLoaded(alreadyLoaded);
        setSkipFade(alreadyLoaded);
        setIsSkeletonGone(alreadyLoaded);
        setIsLowResLoaded(false);
        setHasError(false);
        setShowLqip(Boolean(priority && lqipSrc) && !alreadyLoaded);
    }

    // Timer fallback: reveal LQIP placeholder after 250ms for non-priority to avoid flash
    useEffect(() => {
        if (!isIntersecting || !lqipSrc || isLoaded || priority) return;
        const timer = setTimeout(() => {
            setShowLqip(true);
        }, 250);
        return () => clearTimeout(timer);
    }, [isIntersecting, lqipSrc, isLoaded, priority]);

    // Hard timeout failsafe: if an image request hangs forever, trigger error state gracefully
    useEffect(() => {
        if (!isIntersecting || isLoaded || hasError || !src) return;
        const timer = setTimeout(() => {
            if (!isLoaded) {
                setHasError(true);
            }
        }, timeoutMs);
        return () => clearTimeout(timer);
    }, [isIntersecting, isLoaded, hasError, src, timeoutMs]);

    // Respaldo del onTransitionEnd del skeleton: si la imagen carga antes de que el
    // navegador calcule el estilo inicial del skeleton, el fundido no arranca y
    // transitionend nunca llega (quedaría montado, invisible y con su pulse corriendo).
    // 500 ms = retraso --duration-base (250) + fundido --duration-quick (150) + margen.
    useEffect(() => {
        if (!isLoaded || isSkeletonGone) return;
        const timer = setTimeout(() => setIsSkeletonGone(true), 500);
        return () => clearTimeout(timer);
    }, [isLoaded, isSkeletonGone]);

    // Los onLoad/onError de quien usa el componente se encadenan: antes llegaban
    // por restProps y pisaban estos, y la imagen quedaba en opacity 0 o sin fallback.
    const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        markImageLoaded(src);
        setIsLoaded(true);
        onLoad?.(e);
    }, [src, onLoad]);

    const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        setHasError(true);
        onError?.(e);
    }, [onError]);

    // Si la imagen ya estaba en la caché HTTP del navegador, el navegador completa la carga
    // antes del primer pintado: revelamos de inmediato sin esperar otro ciclo de transición.
    const handleImgRef = useCallback((node: HTMLImageElement | null) => {
        if (node && node.complete && node.naturalWidth > 0 && !isLoaded) {
            markImageLoaded(src);
            setSkipFade(true);
            setIsLoaded(true);
            setIsSkeletonGone(true);
        }
    }, [isLoaded, src]);

    useEffect(() => {
        if (priority || isIntersecting) return;

        const currentElement = containerRef.current;
        if (!currentElement) return;

        const observer = getObserver(rootMargin, thresholdStr);
        observerCallbacks.set(currentElement, () => {
            setIsIntersecting(true);
        });
        observer.observe(currentElement);

        return () => {
            if (currentElement) {
                observerCallbacks.delete(currentElement);
                observer.unobserve(currentElement);
            }
        };
    }, [src, rootMargin, thresholdStr, priority, isIntersecting]);

    return (
        <div
            ref={containerRef}
            style={{ backgroundColor: isLoaded && (isSkeletonGone || !showSkeleton) ? 'transparent' : placeholderColor }}
            className={cn("relative overflow-hidden bg-surface-container-lowest/70", className)}
        >
            {/* Single Pulse Skeleton Layer: sin z-index, queda debajo de la <img> (posicionada
                y después en el DOM). Al cargar sigue opaco mientras la imagen se funde encima
                (duration-base) y recién después se apaga y se desmonta. */}
            {!isSkeletonGone && !hasError && isIntersecting && showSkeleton && (
                <div
                    onTransitionEnd={(e) => {
                        if (isLoaded && e.target === e.currentTarget) setIsSkeletonGone(true);
                    }}
                    className={cn(
                        "absolute inset-0 overflow-hidden",
                        isLoaded && "opacity-0 transition-opacity duration-quick ease-out-strong [transition-delay:var(--duration-base)] motion-reduce:delay-0"
                    )}
                >
                    <div className="h-full w-full animate-pulse motion-reduce:animate-none bg-surface-container-high/80 border border-white/5" />
                </div>
            )}

            {/* Low-res blurred placeholder (LQIP, only if explicit lowResSrc provided) */}
            {!hasError && isIntersecting && lqipSrc && showLqip && (
                <img
                    src={lqipSrc}
                    alt=""
                    aria-hidden="true"
                    crossOrigin={resolvedCrossOrigin}
                    decoding="async"
                    onLoad={() => setIsLowResLoaded(true)}
                    style={objectPosition ? { objectPosition } : undefined}
                    className={cn(
                        "absolute inset-0 h-full w-full object-cover scale-[1.08] filter blur-md transition-opacity duration-base ease-out",
                        isLowResLoaded ? "opacity-100" : "opacity-0",
                        imgClassName
                    )}
                />
            )}

            {/* Main high-res image */}
            {!hasError && isIntersecting && (
                <img
                    ref={handleImgRef}
                    src={src}
                    srcSet={computedSrcSet}
                    sizes={computedSizes}
                    crossOrigin={resolvedCrossOrigin}
                    alt={alt}
                    loading={loading ?? (priority ? "eager" : "lazy")}
                    decoding={decoding ?? (priority ? "sync" : "async")}
                    // Sin prioridad explícita, "auto": Chrome sube a alta las que ya están en pantalla y deja
                    // en baja las que apenas se precargan; un "low" fijo retrasaba incluso a las visibles.
                    fetchPriority={fetchPriority ?? (priority ? "high" : "auto")}
                    onLoad={handleLoad}
                    onError={handleError}
                    className={cn(
                        "relative h-full w-full object-cover",
                        !skipFade && "transition-opacity duration-base ease-out",
                        !isLoaded && "will-change-[opacity]",
                        isLoaded ? "opacity-100" : "opacity-0",
                        imgClassName
                    )}
                    style={objectPosition ? { ...style, objectPosition } : style}
                    {...restProps}
                />
            )}

            {hasError && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-b from-surface-container-high to-surface-container-lowest text-on-surface-variant p-4 border border-white/5">
                    {fallback ? (
                        fallback
                    ) : (
                        <>
                            <IconStatusImageOff className="mb-2 h-7 w-7 text-on-surface-variant/60" />
                            <span className="px-2 text-center text-2xs font-bold tracking-wider text-on-surface-variant line-clamp-2 uppercase">
                                {alt || "Portada no disponible"}
                            </span>
                        </>
                    )}
                </div>
            )}

            {!isIntersecting && !priority && (
                <div className="absolute inset-0" />
            )}
        </div>
    );
}
