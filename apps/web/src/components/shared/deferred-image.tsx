import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/components/ui/core/styling';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageOff } from 'lucide-react';

interface DeferredImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "onDrag"> {
    src: string;
    alt: string;
    placeholderColor?: string;
    rootMargin?: string;
    threshold?: number | number[];
    priority?: boolean;
    aspectRatio?: string;
    showSkeleton?: boolean;
}

const NO_COVER = "/no-cover.png"

export function DeferredImage(props: DeferredImageProps) {
    const {
        src,
        alt,
        className,
        placeholderColor = '#1A1A1A',
        rootMargin = '200px',
        threshold = 0,
        priority = false,
        showSkeleton = true,
        onError,
        onLoad,
        ...restProps
    } = props;

    const [isIntersecting, setIsIntersecting] = useState(priority);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        setIsLoaded(true);
        onLoad?.(e);
    }, [onLoad]);

    const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        setHasError(true);
        onError?.(e);
    }, [onError]);

    useEffect(() => {
        if (priority) {
            Promise.resolve().then(() => {
                setIsIntersecting(true);
            });
            return;
        }

        const currentElement = containerRef.current;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsIntersecting(true);
                    if (currentElement) {
                        observer.unobserve(currentElement);
                    }
                }
            },
            {
                rootMargin,
                threshold,
            }
        );

        if (currentElement) {
            observer.observe(currentElement);
        }

        return () => {
            if (currentElement) {
                observer.unobserve(currentElement);
            }
        };
    }, [rootMargin, threshold, priority]);

    // Only apply srcSet if it's a known image provider that supports it (like TMDB/Platform if they were proxied)
    // For now, we'll keep it simple as we don't know the backend's image resizing capabilities for all sources
    const generateSrcSet = useCallback((url: string): string | undefined => {
        if (!url || url.startsWith('data:') || url.includes('localhost') || url.includes('127.0.0.1')) {
            return undefined;
        }
        // If it's a TMDB image, we could potentially use their API, but we'll stick to a safer approach
        return undefined;
    }, []);

    return (
        <div
            ref={containerRef}
            style={{ backgroundColor: isLoaded ? 'transparent' : placeholderColor }}
            className={cn("relative overflow-hidden", className)}
        >
            <AnimatePresence initial={false}>
                {!isLoaded && !hasError && isIntersecting && showSkeleton && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                        className="absolute inset-0 z-10 overflow-hidden"
                    >
                        <div className="absolute inset-0 animate-pulse bg-zinc-800/80 backdrop-blur-md" />
                        <Skeleton className="h-full w-full rounded-none bg-transparent opacity-50" />
                    </motion.div>
                )}
            </AnimatePresence>

            {!hasError && isIntersecting && (
                <motion.img
                    initial={priority ? { opacity: 1, filter: "blur(0px)" } : { opacity: 0, filter: "blur(10px)", scale: 1.05 }}
                    animate={isLoaded ? { opacity: 1, filter: "blur(0px)", scale: 1 } : priority ? {} : { opacity: 0, filter: "blur(10px)", scale: 1.05 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    src={src}
                    srcSet={generateSrcSet(src)}
                    alt={alt}
                    loading={priority ? "eager" : "lazy"}
                    onLoad={handleLoad}
                    onError={handleError}
                    className={cn(
                        "h-full w-full object-cover will-change-[filter,transform,opacity]",
                        !isLoaded && "invisible"
                    )}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    {...(restProps as any)}
                />
            )}

            {hasError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-zinc-600">
                    <ImageOff className="mb-2 h-8 w-8 opacity-20" />
                    <img
                        src={NO_COVER}
                        alt={alt}
                        className="absolute inset-0 h-full w-full object-cover opacity-10"
                    />
                    <span className="px-4 text-center text-[10px] font-medium uppercase tracking-wider opacity-40">
                        {alt || "Imagen no disponible"}
                    </span>
                </div>
            )}

            {!isIntersecting && !priority && (
                <div className="absolute inset-0" />
            )}
        </div>
    );
}
