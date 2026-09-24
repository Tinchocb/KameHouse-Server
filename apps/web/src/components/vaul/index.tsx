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
                ts.themeEnableBlurringEffects && "bg-zinc-950/70 backdrop-blur-overlay-xl firefox:backdrop-blur-none",
                className)}
            {...props}
        />
    )
})
VaulOverlay.displayName = VaulPrimitive.Overlay.displayName

const VaulContent = React.forwardRef<
    React.ElementRef<typeof VaulPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof VaulPrimitive.Content>
>(({ className, title, children, ...props }, ref) => {
    return (
        <VaulPrimitive.Portal>
            <VaulOverlay />
            <VaulPrimitive.Content
                ref={ref}
                className={cn(
                    "fixed inset-x-0 bottom-0 z-modal mt-24 flex h-auto flex-col rounded-t-2xl border border-b-0 bg-[hsl(var(--background))] safe-area-pb pb-[env(safe-area-inset-bottom,0px)]",
                    "select-none focus:outline-none outline-none outline-0 focus:outline-0",
                    className,
                )}
                title={title}
                {...props}
            >
                {!title ? (
                    <VisuallyHidden>
                        <VaulPrimitive.Title>Drawer</VaulPrimitive.Title>
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

export {
    Vaul,
    VaulContent,
}
