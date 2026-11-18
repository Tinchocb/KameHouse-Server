import { IconUiSpinner } from "@/components/ui/icons";
import { cva } from "class-variance-authority"
import React from "react"

import { cn, ComponentAnatomy, defineStyleAnatomy } from "../core/styling"

/* -------------------------------------------------------------------------------------------------
 * Anatomy
 * -----------------------------------------------------------------------------------------------*/

const LoadingSpinnerAnatomy = defineStyleAnatomy({
    container: cva([
        "UI-LoadingSpinner__container",
        "flex flex-col w-full items-center h-24 justify-center",
    ]),
    icon: cva([
        "UI-LoadingSpinner__icon",
        "inline w-10 h-10 mr-2 animate-spin",
    ]),
    title: cva([
        "UI-LoadingSpinner__title",
        "text-base font-medium text-[--foreground] py-2",
    ]),
})

/* -------------------------------------------------------------------------------------------------
 * LoadingSpinner
 * -----------------------------------------------------------------------------------------------*/

type LoadingSpinnerProps = React.ComponentPropsWithRef<"div"> & ComponentAnatomy<typeof LoadingSpinnerAnatomy>

export const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>((props, ref) => {

    const {
        className,
        containerClass,
        iconClass,
        titleClass,
        title,
        ...rest
    } = props

    return (
        <div
            className={cn(
                LoadingSpinnerAnatomy.container(),
                containerClass,
                className,
            )}
            {...rest}
            ref={ref}
        >
            <Spinner className={iconClass} />
            {title && <p className={cn(LoadingSpinnerAnatomy.title(), titleClass)}>{title}</p>}
        </div>
    )

})

LoadingSpinner.displayName = "LoadingSpinner"


/* -------------------------------------------------------------------------------------------------
 * Spinner
 * -----------------------------------------------------------------------------------------------*/

function Spinner({ className }: { className?: string }) {
    return (
        <IconUiSpinner
            className={cn(
                LoadingSpinnerAnatomy.icon(),
                className,
            )}
        />
    )
}
