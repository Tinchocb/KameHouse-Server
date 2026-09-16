import { cn } from "@/components/ui/core/styling"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import * as React from "react"
import { Drawer as VaulPrimitive } from "vaul"

const Vaul = ({
    shouldScaleBackground = true,
    ...props
}: React.ComponentProps<typeof VaulPrimitive.Root>) => (
    <VaulPrimitive.Root
        shouldScaleBackground={shouldScaleBackground}
        {...props}
    />
)
Vaul.displayName = "Vaul"

const VaulPortal = VaulPrimitive.Portal

const VaulOverlay = React.forwardRef<
    React.ElementRef<typeof VaulPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof VaulPrimitive.Overlay>
>(({ className, ...props }, ref) => {
    const ts = useThemeSettings()
    return (
        <VaulPrimitive.Overlay
            ref={ref}
            className={cn(
                "fixed inset-0 z-50 bg-[color:color-mix(in_srgb,var(--md-sys-color-surface)_80%,transparent)]",
                ts.themeEnableBlurringEffects && "bg-zinc-950/70 backdrop-blur-overlay-xl firefox:backdrop-blur-none",
                className)}
            {...props}
        />
    )
})
VaulOverlay.displayName = VaulPrimitive.Overlay.displayName

const VaulContent = React.forwardRef<
    React.ElementRef<typeof VaulPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof VaulPrimitive.Content> & { overlayClass?: string }
>(({ className, title, children, overlayClass, ...props }, ref) => {
    return (
        <VaulPortal>
            <VaulOverlay className={overlayClass} />
            <VaulPrimitive.Content
                ref={ref}
                className={cn(
                    "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-2xl border border-b-0 bg-[var(--background)] safe-area-pb pb-[env(safe-area-inset-bottom,0px)]",
                    "select-none focus:outline-none outline-none outline-0 focus:outline-0",
                    className,
                )}
                title={title}
                {...props}
            >
                {/*<div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-[--subtle]" />*/}
                {!title ? (
                    <VisuallyHidden>
                        <VaulPrimitive.Title>Drawer</VaulPrimitive.Title>
                    </VisuallyHidden>
                ) : <VaulTitle>
                    {title}
                </VaulTitle>}
                {children}
            </VaulPrimitive.Content>
        </VaulPortal>
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

const VaulDescription = React.forwardRef<
    React.ElementRef<typeof VaulPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof VaulPrimitive.Description>
>(({ className, ...props }, ref) => {
    return (
        <VaulPrimitive.Description
            ref={ref}
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    )
})
VaulDescription.displayName = VaulPrimitive.Description.displayName

export {
    Vaul,
    VaulPortal,
    VaulOverlay,
    VaulContent,
    VaulTitle,
    VaulDescription,
}
