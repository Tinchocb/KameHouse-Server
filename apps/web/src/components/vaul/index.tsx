import { cn } from "@/components/ui/core/styling"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import * as React from "react"
import { Drawer as VaulPrimitive } from "vaul"

const Vaul = ({
    shouldScaleBackground = true,
    autoFocus = true,
    ...props
}: React.ComponentProps<typeof VaulPrimitive.Root>) => (
    <VaulPrimitive.Root
        shouldScaleBackground={shouldScaleBackground}
        autoFocus={autoFocus}
        {...props}
    />
)
Vaul.displayName = "Vaul"

const VaulOverlay = React.forwardRef<
    React.ElementRef<typeof VaulPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof VaulPrimitive.Overlay>
>(({ className, ...props }, ref) => {
    const ts = useThemeSettings()
    return (
        <VaulPrimitive.Overlay
            ref={ref}
            className={cn(
                "fixed inset-0 z-overlay bg-[color:color-mix(in_srgb,var(--md-sys-color-surface)_80%,transparent)]",
                // Mismo velo que el Modal (8 px). El modo plano ([data-flat]) ya lo apaga.
                ts.themeEnableBlurringEffects && "bg-surface-container-lowest/70 backdrop-blur-overlay-xs firefox:backdrop-blur-none",
                className)}
            {...props}
        />
    )
})
VaulOverlay.displayName = VaulPrimitive.Overlay.displayName

const VaulContent = React.forwardRef<
    React.ElementRef<typeof VaulPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof VaulPrimitive.Content> & {
        /** Clases del velo, por ejemplo para acortar su fundido de cierre igual que la hoja. */
        overlayClassName?: string
        surface?: "glass" | "solid"
    }
>(({ className, overlayClassName, surface = "glass", title, children, ...props }, ref) => {
    return (
        <VaulPrimitive.Portal>
            <VaulOverlay className={cn(surface === "glass" && "![backdrop-filter:none]", overlayClassName)} />
            <VaulPrimitive.Content
                ref={ref}
                className={cn(
                    "fixed inset-x-0 bottom-0 z-modal mt-24 flex h-auto flex-col rounded-t-2xl border border-b-0 !pb-[calc(2rem+env(safe-area-inset-bottom,0px))] shadow-elevation-4",
                    "select-none focus:outline-none outline-none outline-0 focus:outline-0",
                    surface === "glass"
                        ? "bg-[var(--sectionbar-bg)] border-[var(--sectionbar-border)] border-t-[var(--sectionbar-border-top)] backdrop-blur-overlay-md backdrop-saturate-[var(--sectionbar-saturate)]"
                        : "bg-[var(--neutral-elev-1)] border-[var(--neutral-separator)]",
                    className,
                )}
                title={title}
                {...props}
            >
                {!title ? (
                    <VisuallyHidden>
                        <VaulPrimitive.Title>Detalles</VaulPrimitive.Title>
                    </VisuallyHidden>
                ) : <VaulTitle>
                    {title}
                </VaulTitle>}
                {children}
            </VaulPrimitive.Content>
        </VaulPrimitive.Portal>
    )
})
VaulContent.displayName = "VaulContent"

const VaulTitle = React.forwardRef<
    React.ElementRef<typeof VaulPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof VaulPrimitive.Title>
>(({ className, ...props }, ref) => {
    return (
        <VaulPrimitive.Title
            ref={ref}
            className={cn(
                "text-2xl font-semibold leading-none tracking-tight",
                className,
            )}
            {...props}
        />
    )
})
VaulTitle.displayName = VaulPrimitive.Title.displayName

const VaulDescription = VaulPrimitive.Description

export {
    Vaul,
    VaulContent,
    VaulDescription,
}
