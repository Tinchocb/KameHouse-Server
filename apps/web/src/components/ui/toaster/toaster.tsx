import { cva } from "class-variance-authority"
import * as React from "react"
import { IconUiAlertTriangle } from "../icons"
import { Toaster as Sonner } from "sonner"
import { cn, defineStyleAnatomy } from "../core/styling"

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

const ToasterAnatomy = defineStyleAnatomy({
    toaster: cva(["group toaster z-toast"]),
    toast: cva([
        "group toast liquid-content",
        "select-none cursor-default",
        "group-[.toaster]:py-4 group-[.toaster]:px-5 group-[.toaster]:gap-3",
        "group-[.toaster]:text-sm group-[.toaster]:font-medium",
        "group-[.toaster]:rounded-2xl group-[.toaster]:border group-[.toaster]:border-t group-[.toaster]:shadow-elevation-4",
        "group-[.toaster]:bg-[var(--sectionbar-bg)] group-[.toaster]:backdrop-blur-overlay-sm group-[.toaster]:backdrop-saturate-[180%] group-[.toaster]:border-[var(--sectionbar-border)] group-[.toaster]:border-t-[var(--sectionbar-border-top)]",
        "group-[.toaster]:text-on-surface",
        // Sin clases transition-*: pisarían la transición propia de Sonner (transform/opacity/height)
        // y los avisos aparecerían y se irían de golpe en vez de deslizarse.
        // Success: el tinte (12%) va como gradiente sobre el vidrio base para no perder opacidad ni contraste
        "group-[.toaster]:data-[type=success]:bg-[linear-gradient(var(--success-bg),var(--success-bg))] group-[.toaster]:data-[type=success]:border-[color:var(--success-border)] group-[.toaster]:data-[type=success]:text-status-success",
        // Warning
        "group-[.toaster]:data-[type=warning]:bg-[linear-gradient(var(--warning-bg),var(--warning-bg))] group-[.toaster]:data-[type=warning]:border-[color:var(--warning-border)] group-[.toaster]:data-[type=warning]:text-status-warning",
        // Error
        "group-[.toaster]:data-[type=error]:bg-[linear-gradient(var(--error-bg),var(--error-bg))] group-[.toaster]:data-[type=error]:border-[color:var(--error-border)] group-[.toaster]:data-[type=error]:text-status-error",
        // Info
        "group-[.toaster]:data-[type=info]:bg-brand-accent/15 group-[.toaster]:data-[type=info]:border-brand-accent/30 group-[.toaster]:data-[type=info]:text-brand-accent-readable",
        // Reservar espacio para la ilustración completa sin tapar el mensaje.
        "data-[type=info]:[&_[data-icon]]:!w-12 data-[type=info]:[&_[data-icon]]:!h-20 data-[type=info]:[&_[data-icon]]:shrink-0",
        "data-[type=warning]:[&_[data-icon]]:!w-12 data-[type=warning]:[&_[data-icon]]:!h-20 data-[type=warning]:[&_[data-icon]]:shrink-0",
    ]),
    description: cva([
        "group-[.toast]:text-xs group-[.toast]:font-normal group-[.toast]:mt-1",
        "group-[.toast]:text-label-2",
        "cursor-default",
    ]),
    actionButton: cva([
        "group-[.toast]:bg-white group-[.toast]:text-black",
        "group-[.toast]:rounded-full group-[.toast]:px-3.5 group-[.toast]:py-1.5",
        "group-[.toast]:text-xs group-[.toast]:font-bold",
        "group-[.toast]:transition-[background-color,transform] group-[.toast]:duration-fast group-[.toast]:ease-out-strong [@media(hover:hover)_and_(pointer:fine)]:hover:!bg-white/90 motion-safe:active:scale-[0.97] cursor-pointer",
        "group-[.toast]:shadow-elevation-1",
    ]),
    cancelButton: cva([
        "group-[.toast]:bg-transparent group-[.toast]:text-on-surface-variant",
        "group-[.toast]:rounded-full group-[.toast]:px-3.5 group-[.toast]:py-1.5",
        "group-[.toast]:text-xs group-[.toast]:font-medium",
        "group-[.toast]:transition-[background-color,transform] group-[.toast]:duration-fast group-[.toast]:ease-out-strong [@media(hover:hover)_and_(pointer:fine)]:hover:!bg-white/10 motion-safe:active:scale-[0.97] cursor-pointer",
    ]),
})

/* -------------------------------------------------------------------------------------------------
 * Toaster
 * -----------------------------------------------------------------------------------------------*/

type ToasterProps = React.ComponentProps<typeof Sonner>

export const Toaster = ({ position = "top-center", className, toastOptions, icons, ...props }: ToasterProps) => {
    return (
        <Sonner
            theme="dark"
            position={position}
            visibleToasts={4}
            icons={{
                info: (
                    <img
                        src="/illustrations/bulma-announcement.webp"
                        alt=""
                        aria-hidden="true"
                        width={48}
                        height={80}
                        className="h-20 w-12 object-contain"
                        decoding="async"
                        draggable={false}
                    />
                ),
                warning: (
                    <span className="relative block h-20 w-12" aria-hidden="true">
                        <img
                            src="/illustrations/bulma-guidance.webp"
                            alt=""
                            width={48}
                            height={80}
                            className="h-20 w-12 object-contain"
                            decoding="async"
                            draggable={false}
                        />
                        <IconUiAlertTriangle className="absolute bottom-0 right-0 h-5 w-5 text-status-warning" />
                    </span>
                ),
                ...icons,
            }}
            // Región en español para lectores de pantalla (por defecto: "Notifications alt+T").
            containerAriaLabel="Avisos"
            // Margen canónico desktop: arriba deja espacio para la barra flotante (~63px).
            offset={{
                top: "76px",
                bottom: "24px",
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
