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

export const ModalAnatomy = defineStyleAnatomy({
    overlay: cva([
        "UI-Modal__overlay",
        "fixed inset-0 z-overlay bg-black/65 backdrop-blur-overlay-xs transition duration-base",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
    ]),
    content: cva([
        "UI-Modal__content",
        "glass-frosted z-modal grid relative w-full max-w-lg gap-4 p-6 duration-base rounded-2xl",
        "shadow-[shadow:var(--glass-highlight-lg),0_24px_48px_-12px_rgba(0,0,0,0.9)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        // Entra con ease-out fuerte; al cerrar responde más rápido de lo que abrió.
        "ease-out-strong data-[state=closed]:duration-fast",
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
        "text-xl font-semibold leading-none tracking-tight",
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
    ComponentAnatomy<typeof ModalAnatomy>
    & {
        /**
         * Interaction with outside elements will be enabled and other elements will be visible to screen readers.
         */
        allowOutsideInteraction?: boolean
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
         * Optional replacement for the default close button
         */
        closeButton?: React.ReactElement
        /**
         * Whether to hide the close button
         */
        hideCloseButton?: boolean
        portalContainer?: HTMLElement
    }

export function Modal(props: ModalProps) {

    const {
        allowOutsideInteraction = false,
        trigger,
        title,
        srTitle,
        footer,
        description,
        children,
        closeButton,
        overlayClass,
        contentClass,
        closeClass,
        headerClass,
        footerClass,
        titleClass,
        descriptionClass,
        hideCloseButton,
        // Content
        onOpenAutoFocus,
        onCloseAutoFocus,
        onEscapeKeyDown,
        onPointerDownCapture,
        onInteractOutside,
        portalContainer,
        ...rest
    } = props

    return <DialogPrimitive.Root modal={!allowOutsideInteraction} {...rest}>

        {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}

        <DialogPrimitive.Portal container={portalContainer}>
            <DialogPrimitive.Overlay className={cn(ModalAnatomy.overlay(), overlayClass)} />
            <div
                className={cn(
                    "fixed inset-0 z-modal overflow-y-auto grid place-items-center p-3 md:p-4 pointer-events-none",
                    __isDesktop__ && "md:p-8",
                )}
            >
                <DialogPrimitive.Content
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
                        <div className={cn(ModalAnatomy.header(), headerClass)}>
                            {title && (
                                <DialogPrimitive.Title className={cn(ModalAnatomy.title(), titleClass)}>
                                    {title}
                                </DialogPrimitive.Title>
                            )}
                            {description && (
                                <DialogPrimitive.Description className={cn(ModalAnatomy.description(), descriptionClass)}>
                                    {description}
                                </DialogPrimitive.Description>
                            )}
                        </div>
                    )}

                    {children}

                    {footer && <div className={cn(ModalAnatomy.footer(), footerClass)}>
                        {footer}
                    </div>}

                    {!hideCloseButton && <DialogPrimitive.Close className={cn(ModalAnatomy.close(), closeClass)} asChild>
                        {closeButton ? closeButton : <CloseButton aria-label="Cerrar ventana modal" />}
                    </DialogPrimitive.Close>}

                </DialogPrimitive.Content>
            </div>
        </DialogPrimitive.Portal>

    </DialogPrimitive.Root>
}

Modal.displayName = "Modal"
