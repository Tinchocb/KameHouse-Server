import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/components/ui/core/styling';
import { IconStatusImageOff } from "@/components/ui/icons";
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from '@/lib/hardware/performance-store';
import { isImageLoaded, markImageLoaded } from '@/lib/helpers/images';

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

function getTmdbSrcSet(url: string): string | undefined {
    if (!url || (!url.includes("tmdb.org") && !url.includes("themoviedb.org"))) {
        return undefined;
    }
    const w185 = url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w185");
    const w342 = url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w342");
    const w500 = url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w500");
    const w780 = url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w780");
    const w1280 = url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w1280");
    return `${w185} 185w, ${w342} 342w, ${w500} 500w, ${w780} 780w, ${w1280} 1280w`;
}

/**
 * srcSet para heroes a pantalla completa: arranca en w780 y llega a `original`
 * (los backdrops de TMDB son ≥1920 de ancho), así en 1440p/4K no se estira w1280.
 */
export function getTmdbHeroSrcSet(url: string): string | undefined {
    if (!url || (!url.includes("tmdb.org") && !url.includes("themoviedb.org"))) {
        return undefined;
    }
    const size = (s: string) => url.replace(/\/t\/p\/(?:original|w\d+)/, `/t/p/${s}`);
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
        src,
        alt,
        lowResSrc,
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
        fetchPriority,
        loading,
        decoding,
        objectPosition,
        style,
        ...restProps
    } = props;

    const [isIntersecting, setIsIntersecting] = useState(priority);
    // Si la URL ya terminó de descargarse antes (rotación o prewarm), no
    // flashear el skeleton: arrancar como cargada.
    const [isLoaded, setIsLoaded] = useState(() => isImageLoaded(src));
    const [isLowResLoaded, setIsLowResLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [showLqip, setShowLqip] = useState(Boolean(priority && lowResSrc));

    const containerRef = useRef<HTMLDivElement>(null);
    const thresholdStr = Array.isArray(threshold) ? threshold.join(',') : String(threshold);

    const lqipSrc = lowResSrc;
    const computedSrcSet = srcSet ?? getTmdbSrcSet(src);
    const computedSizes = sizes ?? (computedSrcSet ? '(max-width: 640px) 185px, (max-width: 1024px) 342px, 500px' : undefined);

    const [prevProps, setPrevProps] = useState({ src, priority, lqipSrc });
    if (src !== prevProps.src || priority !== prevProps.priority || lqipSrc !== prevProps.lqipSrc) {
        setPrevProps({ src, priority, lqipSrc });
        setIsIntersecting(priority);
        const alreadyLoaded = isImageLoaded(src);
        setIsLoaded(alreadyLoaded);
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

    const handleLoad = useCallback(() => {
        markImageLoaded(src);
        setIsLoaded(true);
    }, [src]);

    const handleError = useCallback(() => {
        setHasError(true);
    }, []);

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
            style={{ backgroundColor: isLoaded ? 'transparent' : placeholderColor }}
            className={cn("relative overflow-hidden bg-zinc-950/70", className)}
        >
            {/* Single Pulse Skeleton Layer */}
            {!isLoaded && !hasError && isIntersecting && showSkeleton && (
                <div className="absolute inset-0 z-10 overflow-hidden">
                    <div className="h-full w-full animate-pulse bg-zinc-900/80 border border-white/5" />
                </div>
            )}

            {/* Low-res blurred placeholder (LQIP, only if explicit lowResSrc provided) */}
            {!hasError && isIntersecting && lqipSrc && showLqip && (
                <img
                    src={lqipSrc}
                    alt=""
                    aria-hidden="true"
                    decoding="async"
                    onLoad={() => setIsLowResLoaded(true)}
                    style={objectPosition ? { objectPosition } : undefined}
                    className={cn(
                        "absolute inset-0 h-full w-full object-cover scale-[1.08] filter blur-md transition-opacity duration-slow ease-out",
                        isLowResLoaded ? "opacity-100" : "opacity-0",
                        imgClassName
                    )}
                />
            )}

            {/* Main high-res image */}
            {!hasError && isIntersecting && (
                <img
                    src={src}
                    srcSet={computedSrcSet}
                    sizes={computedSizes}
                    alt={alt}
                    loading={loading ?? (priority ? "eager" : "lazy")}
                    decoding={decoding ?? "async"}
                    fetchPriority={fetchPriority ?? (priority ? "high" : "low")}
                    onLoad={handleLoad}
                    onError={handleError}
                    className={cn(
                        "relative h-full w-full object-cover transition-opacity duration-slow ease-out",
                        !isLoaded && "will-change-[opacity]",
                        isLoaded ? "opacity-100" : "opacity-0",
                        imgClassName
                    )}
                    style={objectPosition ? { ...style, objectPosition } : style}
                    {...restProps}
                />
            )}

            {hasError && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-950 text-zinc-400 p-4 border border-white/5">
                    {fallback ? (
                        fallback
                    ) : (
                        <>
                            <IconStatusImageOff className="mb-2 h-7 w-7 text-zinc-500 opacity-60" />
                            <span className="px-2 text-center text-2xs font-bold tracking-wider text-zinc-300 line-clamp-2 uppercase">
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
