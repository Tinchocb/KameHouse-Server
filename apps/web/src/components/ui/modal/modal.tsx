import { __isDesktop__ } from "@/types/constants"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { cva } from "class-variance-authority"
import * as React from "react"
import { CloseButton } from "../button"
import { cn, ComponentAnatomy, defineStyleAnatomy } from "../core/styling"

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

const ModalAnatomy = defineStyleAnatomy({
    overlay: cva([
        "UI-Modal__overlay",
        "fixed inset-0 z-overlay bg-black/65 transition-opacity duration-base",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        // Con prefijo: animate-in (0,2,0) fija 150 ms y le gana a la duración suelta.
        // Misma curva que el contenido: sin ella el velo usaba el `ease` por defecto de CSS.
        "ease-smooth-out data-[state=open]:duration-normal data-[state=closed]:duration-quick",
        "motion-reduce:!animate-none motion-reduce:transition-none",
    ]),
    content: cva([
        "UI-Modal__content",
        "glass-frosted z-modal grid relative w-full max-w-lg gap-4 p-6 duration-base rounded-2xl",
        "shadow-[shadow:var(--glass-highlight-lg),var(--elevation-5)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]",
        // Entrada gradual y zoom discreto; cierre breve para devolver el contexto.
        "ease-smooth-out data-[state=open]:duration-normal data-[state=closed]:duration-quick",
        "motion-reduce:!animate-none motion-reduce:transition-none",
    ]),
    close: cva([
        "UI-Modal__close",
        "absolute right-4 top-4 !mt-0",
    ]),
    header: cva([
        "UI-Modal__header",
        "flex flex-col space-y-1.5 text-center sm:text-left",
    ]),
    footer: cva([
        "UI-Modal__footer",
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
    ]),
    title: cva([
        "UI-Modal__title",
        "text-xl font-semibold leading-none tracking-tight text-balance",
    ]),
    description: cva([
        "UI-Modal__description",
        "text-sm text-muted-foreground",
    ]),
})

/* -------------------------------------------------------------------------------------------------
 * Modal
 * -----------------------------------------------------------------------------------------------*/

export type ModalProps =
    Omit<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>, "modal">
    &
    Pick<React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "onOpenAutoFocus" | "onCloseAutoFocus" | "onEscapeKeyDown" | "onPointerDownCapture" | "onInteractOutside">
    &
    Pick<ComponentAnatomy<typeof ModalAnatomy>, "contentClass" | "closeClass">
    & {
        /**
         * The button that opens the modal
         */
        trigger?: React.ReactElement
        /**
         * Title of the modal
         */
        title?: React.ReactNode
        /**
         * Nombre accesible cuando no hay `title` visible (paletas, visores). Sin esto el diálogo
         * quedaba con aria-labelledby apuntando a un elemento que no existe.
         */
        srTitle?: string
        /**
         * An optional accessible description to be announced when the dialog is opened.
         */
        description?: React.ReactNode
        /**
         * Footer of the modal
         */
        footer?: React.ReactNode
        /**
         * Whether to hide the close button
         */
        hideCloseButton?: boolean
    }

export function Modal(props: ModalProps) {

    const {
        trigger,
        title,
        srTitle,
        footer,
        description,
        children,
        contentClass,
        closeClass,
        hideCloseButton,
        // Content
        onOpenAutoFocus,
        onCloseAutoFocus,
        onEscapeKeyDown,
        onPointerDownCapture,
        onInteractOutside,
        ...rest
    } = props

    return <DialogPrimitive.Root {...rest}>

        {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}

        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className={ModalAnatomy.overlay()} />
            <div
                className={cn(
                    "fixed inset-0 z-modal overflow-y-auto grid place-items-center p-3 md:p-4 pointer-events-none",
                    __isDesktop__ && "md:p-8",
                )}
            >
                <DialogPrimitive.Content
                    data-liquid-surface="panel"
                    className={cn(ModalAnatomy.content(), "pointer-events-auto", contentClass)}
                    onOpenAutoFocus={onOpenAutoFocus}
                    onCloseAutoFocus={onCloseAutoFocus}
                    onEscapeKeyDown={onEscapeKeyDown}
                    onPointerDownCapture={onPointerDownCapture}
                    onInteractOutside={onInteractOutside}
                >
                    {!description && (
                        <VisuallyHidden asChild>
                            <DialogPrimitive.Description />
                        </VisuallyHidden>
                    )}

                    {!title && (
                        <VisuallyHidden asChild>
                            <DialogPrimitive.Title>{srTitle ?? "Ventana"}</DialogPrimitive.Title>
                        </VisuallyHidden>
                    )}

                    {(title || description) && (
                        <div className={ModalAnatomy.header()}>
                            {title && (
                                <DialogPrimitive.Title className={ModalAnatomy.title()}>
                                    {title}
                                </DialogPrimitive.Title>
                            )}
                            {description && (
                                <DialogPrimitive.Description className={ModalAnatomy.description()}>
                                    {description}
                                </DialogPrimitive.Description>
                            )}
                        </div>
                    )}

                    {children}

                    {footer && <div className={ModalAnatomy.footer()}>
                        {footer}
                    </div>}

                    {!hideCloseButton && <DialogPrimitive.Close className={cn(ModalAnatomy.close(), closeClass)} asChild>
                        <CloseButton aria-label="Cerrar" />
                    </DialogPrimitive.Close>}

                </DialogPrimitive.Content>
            </div>
        </DialogPrimitive.Portal>

    </DialogPrimitive.Root>
}

Modal.displayName = "Modal"
