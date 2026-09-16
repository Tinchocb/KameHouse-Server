import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/components/ui/core/styling';
import { Skeleton } from '@/components/ui/skeleton';
import { IconStatusImageOff } from "@/components/ui/icons";

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
}

function getTmdbSrcSet(url: string): string | undefined {
    if (!url || (!url.includes("tmdb.org") && !url.includes("themoviedb.org"))) {
        return undefined;
    }
    const w185 = url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w185");
    const w342 = url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w342");
    const w500 = url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w500");
    const w780 = url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w780");
    return `${w185} 185w, ${w342} 342w, ${w500} 500w, ${w780} 780w`;
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
    const {
        src,
        alt,
        lowResSrc,
        className,
        placeholderColor = 'rgba(24, 24, 27, 0.6)',
        rootMargin = '400px',
        threshold = 0,
        priority = false,
        showSkeleton = true,
        fallback,
        imgClassName,
        timeoutMs = 7000,
        sizes,
        srcSet,
        onError,
        onLoad,
        ...restProps
    } = props;

    const computedSrcSet = srcSet || getTmdbSrcSet(src);
    const computedSizes = sizes || (computedSrcSet ? "(max-width: 640px) 185px, (max-width: 1024px) 342px, 500px" : undefined);

    const [isIntersecting, setIsIntersecting] = useState(priority);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLowResLoaded, setIsLowResLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    // Only show separate LQIP if explicitly requested via lowResSrc to avoid double-fetching TMDB CDN
    const [showLqip, setShowLqip] = useState(!priority && Boolean(lowResSrc));
    const containerRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setIsLoaded(false);
        setIsLowResLoaded(false);
        setHasError(false);
        setIsIntersecting(priority);
        setShowLqip(!priority && Boolean(lowResSrc));
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (watchdogTimerRef.current) {
            clearTimeout(watchdogTimerRef.current);
            watchdogTimerRef.current = null;
        }
    }, [src, priority, lowResSrc]);

    const lqipSrc = lowResSrc;

    const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        setIsLoaded(true);
        if (watchdogTimerRef.current) {
            clearTimeout(watchdogTimerRef.current);
            watchdogTimerRef.current = null;
        }
        onLoad?.(e);
        
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setShowLqip(false);
        }, 600);
    }, [onLoad]);

    const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        setHasError(true);
        if (watchdogTimerRef.current) {
            clearTimeout(watchdogTimerRef.current);
            watchdogTimerRef.current = null;
        }
        onError?.(e);
    }, [onError]);
    const thresholdStr = Array.isArray(threshold) ? threshold.join(',') : String(threshold);

    // Watchdog: si la imagen está en viewport pero ni carga ni falla tras timeoutMs, abortar y disparar fallback
    useEffect(() => {
        if (isIntersecting && !isLoaded && !hasError && src && timeoutMs > 0) {
            watchdogTimerRef.current = setTimeout(() => {
                setHasError(true);
                onError?.({
                    currentTarget: {} as HTMLImageElement,
                    target: {} as HTMLImageElement,
                } as unknown as React.SyntheticEvent<HTMLImageElement>);
            }, timeoutMs);
        }
        return () => {
            if (watchdogTimerRef.current) {
                clearTimeout(watchdogTimerRef.current);
                watchdogTimerRef.current = null;
            }
        };
    }, [isIntersecting, isLoaded, hasError, src, timeoutMs, onError]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!src) {
            setHasError(true);
            setIsLoaded(true);
            setIsIntersecting(true);
            return;
        }

        if (priority) {
            if (!isIntersecting) {
                setIsIntersecting(true);
            }
            return;
        }

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
    }, [src, rootMargin, thresholdStr, priority]);

    return (
        <div
            ref={containerRef}
            style={{ backgroundColor: isLoaded ? 'transparent' : placeholderColor }}
            className={cn("relative overflow-hidden bg-zinc-950/70", className)}
        >
            {/* Pulse Skeleton: shown while high-res image is NOT loaded */}
            {!isLoaded && !hasError && isIntersecting && showSkeleton && (
                <div className="absolute inset-0 z-10 overflow-hidden">
                    <div className="absolute inset-0 animate-pulse bg-zinc-900/80 border border-white/5" />
                    <Skeleton className="h-full w-full rounded-none bg-transparent opacity-40" />
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
                    loading={priority ? "eager" : "lazy"}
                    decoding="async"
                    onLoad={handleLoad}
                    onError={handleError}
                    className={cn(
                        "relative h-full w-full object-cover transition-opacity duration-slow ease-out",
                        !isLoaded && "will-change-[opacity]",  // Only hint GPU during the fade-in
                        isLoaded ? "opacity-100" : "opacity-0",
                        imgClassName
                    )}
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
                            <span className="px-2 text-center text-[11px] font-bold tracking-wider text-zinc-300 line-clamp-2 uppercase">
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
