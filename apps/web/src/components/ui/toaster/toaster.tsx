import { cva } from "class-variance-authority"
import * as React from "react"
import { Toaster as Sonner } from "sonner"
import { cn, defineStyleAnatomy } from "../core/styling"

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

export const ToasterAnatomy = defineStyleAnatomy({
    toaster: cva(["group toaster z-toast"]),
    toast: cva([
        "group/toast",
        "select-none cursor-default",
        "group-[.toaster]:py-4 group-[.toaster]:px-5 group-[.toaster]:gap-3",
        "group-[.toaster]:text-sm group-[.toaster]:font-medium",
        "group-[.toaster]:rounded-2xl group-[.toaster]:border group-[.toaster]:border-t group-[.toaster]:shadow-elevation-4",
        "group-[.toaster]:bg-[color:color-mix(in_srgb,var(--md-sys-color-surface-container)_90%,transparent)] group-[.toaster]:backdrop-blur-overlay-sm group-[.toaster]:backdrop-saturate-[180%] group-[.toaster]:border-white/15 group-[.toaster]:border-t-white/35",
        "group-[.toaster]:text-on-surface",
        // Sin clases transition-*: pisarían la transición propia de Sonner (transform/opacity/height)
        // y los avisos aparecerían y se irían de golpe en vez de deslizarse.
        // Success
        "group-[.toaster]:data-[type=success]:bg-success-bg group-[.toaster]:data-[type=success]:border-success-border group-[.toaster]:data-[type=success]:text-success-bg",
        // Warning
        "group-[.toaster]:data-[type=warning]:bg-warning-bg group-[.toaster]:data-[type=warning]:border-warning-border group-[.toaster]:data-[type=warning]:text-warning-bg",
        // Error
        "group-[.toaster]:data-[type=error]:bg-error-bg group-[.toaster]:data-[type=error]:border-error-border group-[.toaster]:data-[type=error]:text-error-bg",
        // Info
        "group-[.toaster]:data-[type=info]:bg-brand-accent/15 group-[.toaster]:data-[type=info]:border-brand-accent/30 group-[.toaster]:data-[type=info]:text-brand-accent",
    ]),
    description: cva([
        "group/toast:text-xs group/toast:font-normal group/toast:mt-1",
        "group/toast:opacity-80",
        "group/toast:text-on-surface-variant",
        "cursor-default",
    ]),
    actionButton: cva([
        "group/toast:bg-white group/toast:text-black",
        "group/toast:rounded-full group/toast:px-3.5 group/toast:py-1.5",
        "group/toast:text-xs group/toast:font-bold",
        "group/toast:transition-[background-color,transform] group/toast:duration-fast group/toast:ease-out-strong group/toast:hover:bg-white/90 group/toast:active:scale-95 cursor-pointer",
        "group/toast:shadow-elevation-1",
    ]),
    cancelButton: cva([
        "group/toast:bg-transparent group/toast:text-on-surface-variant",
        "group/toast:rounded-full group/toast:px-3.5 group/toast:py-1.5",
        "group/toast:text-xs group/toast:font-medium",
        "group/toast:transition-[background-color,transform] group/toast:duration-fast group/toast:ease-out-strong group/toast:hover:bg-white/10 group/toast:active:scale-95 cursor-pointer",
    ]),
})

/* -------------------------------------------------------------------------------------------------
 * Toaster
 * -----------------------------------------------------------------------------------------------*/

export type ToasterProps = React.ComponentProps<typeof Sonner>

export const Toaster = ({ position = "top-center", className, toastOptions, ...props }: ToasterProps) => {
    return (
        <Sonner
            theme="dark"
            position={position}
            visibleToasts={4}
            // Sonner no conoce las zonas seguras: con viewport-fit=cover (PWA o
            // celular en horizontal) el toast quedaba bajo la muesca/isla o la
            // barra de gestos. Mismos márgenes por defecto (24/16 px) + el inset.
            offset={{
                top: "calc(24px + env(safe-area-inset-top, 0px))",
                bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
            }}
            mobileOffset={{
                top: "calc(16px + env(safe-area-inset-top, 0px))",
                bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
            }}
            className={cn(ToasterAnatomy.toaster(), className)}
            toastOptions={{
                classNames: {
                    toast: cn(ToasterAnatomy.toast()),
                    description: cn(ToasterAnatomy.description()),
                    actionButton: cn(ToasterAnatomy.actionButton()),
                    cancelButton: cn(ToasterAnatomy.cancelButton()),
                    ...toastOptions?.classNames,
                },
                ...toastOptions,
            }}
            {...props}
        />
    )
}

Toaster.displayName = "Toaster"