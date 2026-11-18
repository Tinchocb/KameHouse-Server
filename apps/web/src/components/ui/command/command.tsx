import { cva } from "class-variance-authority"
import { Command as CommandPrimitive } from "cmdk"
import * as React from "react"
import { cn, ComponentAnatomy, defineStyleAnatomy } from "../core/styling"
import { InputAnatomy } from "../input/input-parts"
import { Modal, ModalProps } from "../modal"

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

const CommandAnatomy = defineStyleAnatomy({
    root: cva([
        "UI-Command__root",
        "flex h-full w-full flex-col overflow-hidden rounded-container bg-surface-container text-on-surface border border-[var(--neutral-separator)] border-t-[var(--glass-border-top)] shadow-[shadow:var(--double-bezel-shadow)]",
    ]),
    inputContainer: cva([
        "UI-Command__input",
        "flex items-center px-3 py-2",
        "cmdk-input-wrapper",
    ]),
    inputIcon: cva([
        "UI-Command__inputIcon",
        "mr-2 h-5 w-5 shrink-0 opacity-50",
    ]),
    list: cva([
        "UI-Command__list",
        "max-h-[300px] overflow-y-auto overflow-x-hidden",
    ]),
    empty: cva([
        "UI-Command__empty",
        "py-6 text-center text-base text-on-surface-variant",
    ]),
    group: cva([
        "UI-Command__group",
        "overflow-hidden p-1 text-on-surface",
        "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-on-surface-variant",
    ]),
    item: cva([
        "UI-Command__item",
        "relative flex cursor-default select-none items-center rounded-lg px-2 py-1.5 text-base outline-none",
        "aria-selected:bg-[var(--neutral-elev-2)] aria-selected:text-on-surface data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    ]),
})

const CommandDialogAnatomy = defineStyleAnatomy({
    content: cva([
        "UI-CommandDialog__content",
        "overflow-hidden p-0",
        // Se abre con teclado y muchas veces al día: aparece y se va al instante, sin zoom.
        // `!` porque animate-in del plugin se declara después de animate-none y ganaría.
        "data-[state=open]:!animate-none data-[state=closed]:!animate-none",
    ]),
    command: cva([
        "UI-CommandDialog__command",
        "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-on-surface-variant",
        "[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pb-2 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5",
        "[&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-5",
    ]),
})


/* -------------------------------------------------------------------------------------------------
 * Command
 * -----------------------------------------------------------------------------------------------*/

type CommandProps = React.ComponentPropsWithoutRef<typeof CommandPrimitive>

const Command = React.forwardRef<HTMLDivElement, CommandProps>((props, ref) => {
    const {
        className,
        loop = true,
        ...rest
    } = props

    return (
        <CommandPrimitive
            ref={ref}
            className={cn(CommandAnatomy.root(), className)}
            loop={loop}
            {...rest}
        />
    )
})
Command.displayName = CommandPrimitive.displayName

/* -------------------------------------------------------------------------------------------------
 * CommandInput
 * -----------------------------------------------------------------------------------------------*/

type CommandInputProps =
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
    & Pick<ComponentAnatomy<typeof CommandAnatomy>, "inputContainerClass">

export const CommandInput = React.forwardRef<HTMLInputElement, CommandInputProps>((props, ref) => {
    const {
        className,
        inputContainerClass,
        ...rest
    } = props

    return (
        <div className={cn(CommandAnatomy.inputContainer(), inputContainerClass)} {...{ "cmdk-input-wrapper": "" }}>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={CommandAnatomy.inputIcon()}
            >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
            </svg>
            <CommandPrimitive.Input
                ref={ref}
                className={cn(InputAnatomy.root({
                    intent: "unstyled",
                    size: "sm",
                    isDisabled: rest.disabled,
                }), className)}
                {...rest}
            />
        </div>
    )
})
CommandInput.displayName = "CommandInput"

/* -------------------------------------------------------------------------------------------------
 * CommandList
 * -----------------------------------------------------------------------------------------------*/

type CommandListProps =
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>

export const CommandList = React.forwardRef<HTMLDivElement, CommandListProps>((props, ref) => {
    const { className, ...rest } = props

    return (
        <CommandPrimitive.List
            ref={ref}
            className={cn(CommandAnatomy.list(), className)}
            {...rest}
        />
    )
})
CommandList.displayName = "CommandList"

/* -------------------------------------------------------------------------------------------------
 * CommandEmpty
 * -----------------------------------------------------------------------------------------------*/

type CommandEmptyProps =
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>

export const CommandEmpty = React.forwardRef<HTMLDivElement, CommandEmptyProps>((props, ref) => {
    const { className, ...rest } = props

    return (
        <CommandPrimitive.Empty
            ref={ref}
            className={cn(CommandAnatomy.empty(), className)}
            {...rest}
        />
    )
})
CommandEmpty.displayName = "CommandEmpty"

/* -------------------------------------------------------------------------------------------------
 * CommandGroup
 * -----------------------------------------------------------------------------------------------*/

type CommandGroupProps =
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>

export const CommandGroup = React.forwardRef<HTMLDivElement, CommandGroupProps>((props, ref) => {
    const { className, ...rest } = props

    return (
        <CommandPrimitive.Group
            ref={ref}
            className={cn(CommandAnatomy.group(), className)}
            {...rest}
        />
    )
})
CommandGroup.displayName = "CommandGroup"

/* -------------------------------------------------------------------------------------------------
 * CommandItem
 * -----------------------------------------------------------------------------------------------*/

type CommandItemProps = React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>

export const CommandItem = React.forwardRef<HTMLDivElement, CommandItemProps>((props, ref) => {
    const { className, children, ...rest } = props

    // Sin scrollIntoView propio: cmdk ya desplaza la selección al navegar con teclado, y a
    // propósito no lo hace cuando la selección llega por el puntero (la lista saltaba bajo el mouse).
    return (
        <CommandPrimitive.Item
            ref={ref}
            className={cn(CommandAnatomy.item(), className)}
            {...rest}
            data-cmdkvalue={rest.id}
        >
            {children}
        </CommandPrimitive.Item>
    )
})
CommandItem.displayName = "CommandItem"

/* -------------------------------------------------------------------------------------------------
 * CommandDialog
 * -----------------------------------------------------------------------------------------------*/

type CommandDialogProps = ModalProps & Pick<ComponentAnatomy<typeof CommandDialogAnatomy>, "contentClass"> & {
    commandProps: React.ComponentPropsWithoutRef<typeof CommandPrimitive>
}

export const CommandDialog = (props: CommandDialogProps) => {
    const { children, contentClass, commandProps, ...rest } = props
    return (
        <Modal
            srTitle="Buscar en KameHouse"
            // 36 px con puntero fino (el IconButton sm da 32); con puntero grueso se queda en 44.
            closeClass="[@media(pointer:fine)]:!h-9 [@media(pointer:fine)]:!w-9"
            {...rest}
            contentClass={cn(CommandDialogAnatomy.content(), contentClass)}
        >
            <Command shouldFilter={false} className={CommandDialogAnatomy.command()} {...commandProps}>
                {children}
            </Command>
        </Modal>
    )
}

CommandDialog.displayName = "CommandDialog"
