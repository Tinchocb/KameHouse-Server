import { HIDE_IMAGES } from "@/types/constants"
import { motion } from "framer-motion"
import React, { forwardRef, useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/components/ui/core/styling"

type ImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "onDrag"> & {
    fill?: boolean
    priority?: boolean
    overrideSrc?: string
    quality?: number | string
    placeholder?: string
    blurDataURL?: string
    sizes?: string
    allowGif?: boolean
}

export const SeaImage = forwardRef<HTMLImageElement, ImageProps & { isExternal?: boolean }>(
    ({ isExternal, fill, priority, quality, placeholder, sizes, allowGif, ...props }, ref) => {
        const [hasError, setHasError] = useState(false)

        useEffect(() => {
            setHasError(false)
        }, [props.src])

        if (HIDE_IMAGES) {
            return <Image
                ref={ref}
                {...props}
                src="/no-cover.png"
                className={props.className}
                alt={props.alt || "cover"}
                fill={fill}
            />
        }

        const blocked = isExternal && props.src && typeof props.src === "string" && !(
            props.src.endsWith(".png")
            || props.src.endsWith(".jpg")
            || props.src.endsWith(".jpeg")
            || props.src.endsWith(".avif")
            || props.src.endsWith(".webp")
            || props.src.endsWith(".ico")
            || (allowGif && props.src.endsWith(".gif"))
        )

        const effectiveOverride = (blocked || hasError) ? "/no-cover.png" : props.overrideSrc

        function handleError() {
            setHasError(true)
            console.warn(`Error loading image ${props.src}`)
        }

        return <Image
            ref={ref}
            {...props}
            src={props.src || ""}
            alt={props.alt || ""}
            fill={fill}
            priority={priority}
            placeholder={placeholder}
            overrideSrc={effectiveOverride}
            onError={handleError}
        />
    },
)

SeaImage.displayName = "SeaImage"

interface _ImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "onDrag"> {
    src: string | any
    alt: string
    width?: number | string
    height?: number | string
    fill?: boolean
    quality?: number | string
    priority?: boolean
    loader?: any
    placeholder?: string
    blurDataURL?: string
    unoptimized?: boolean
    onLoadingComplete?: (img: HTMLImageElement) => void
    layout?: string
    objectFit?: string
    overrideSrc?: string
}

const Image = forwardRef<HTMLImageElement, _ImageProps>((
    {
        src,
        alt,
        width,
        height,
        fill,
        style,
        className,
        quality,
        priority,
        loader,
        placeholder,
        blurDataURL,
        unoptimized,
        onLoadingComplete,
        layout,
        objectFit,
        overrideSrc,
        onLoad,
        ...props
    },
    ref,
) => {
    const [isLoaded, setIsLoaded] = useState(false)

    const isStaticImport = typeof src === "object" && src !== null && "src" in src
    const imageSrc = overrideSrc || (isStaticImport ? src.src : src)

    const staticBlur = isStaticImport ? src.blurDataURL : undefined

    useEffect(() => {
        setIsLoaded(false)
    }, [imageSrc])

    const blurUrl = (placeholder && placeholder !== "blur" && placeholder !== "empty")
        ? placeholder
        : (placeholder === "blur" ? (blurDataURL || staticBlur) : undefined)

    const fillStyle: React.CSSProperties = fill ? {
        position: "absolute",
        height: "100%",
        width: "100%",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        color: "transparent",
    } : {}

    const placeholderStyle: React.CSSProperties = (blurUrl && !isLoaded) ? {
        backgroundImage: `url("${blurUrl}")`,
        backgroundSize: objectFit === "contain" ? "contain" : "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
    } : {}

    const imageWidth = fill ? undefined : (width || (isStaticImport ? src.width : undefined))
    const imageHeight = fill ? undefined : (height || (isStaticImport ? src.height : undefined))

    return (
        <>
            {!isLoaded && (
                <Skeleton
                    className={cn("absolute inset-0 z-0", className)}
                    style={{
                        ...fillStyle,
                        ...style,
                    }}
                />
            )}
            <motion.img
                initial={{ opacity: 0, filter: "blur(10px)" }}
                animate={{
                    opacity: isLoaded ? 1 : 0,
                    filter: isLoaded ? "blur(0px)" : "blur(10px)"
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                ref={ref}
                src={imageSrc}
                alt={alt}
                width={imageWidth}
                height={imageHeight}
                decoding="async"
                loading={priority ? "eager" : "lazy"}
                className={cn(className, "relative z-10")}
                style={{
                    ...fillStyle,
                    ...placeholderStyle,
                    ...(objectFit ? { objectFit: objectFit as any } : {}),
                    ...style,
                }}
                onLoad={(e) => {
                    setIsLoaded(true)
                    onLoad?.(e)
                }}
                {...(props as any)}
            />
        </>
    )
})

Image.displayName = "Image"
