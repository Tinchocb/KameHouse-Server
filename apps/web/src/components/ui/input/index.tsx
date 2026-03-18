import * as React from "react"
import { cn } from "../core/styling"
import { InputAnatomy, extractInputPartProps, InputStyling, hiddenInputStyles } from "./input-parts"

export interface InputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
        InputStyling {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        const [
            partProps,
            { inputContainerProps, leftAddonProps, rightAddonProps, leftIconProps, rightIconProps },
        ] = extractInputPartProps(props as any)

        const {
            size,
            intent,
            hasError,
            leftAddon,
            leftIcon,
            rightAddon,
            rightIcon,
            ...rest
        } = partProps as any

        return (
            <div className={cn("relative flex w-full items-center", inputContainerProps.className)}>
                {leftAddonProps.addon && <div className="flex-none">{leftAddonProps.addon}</div>}
                {leftIconProps.icon && (
                    <div className="absolute left-3 flex items-center pointer-events-none">
                        {leftIconProps.icon}
                    </div>
                )}
                <input
                    type={type}
                    className={cn(
                        InputAnatomy.root({
                            size: size,
                            intent: intent,
                            hasError: hasError,
                            isDisabled: props.disabled,
                            hasLeftIcon: !!leftIconProps.icon,
                            hasRightIcon: !!rightIconProps.icon,
                            hasLeftAddon: !!leftAddonProps.addon,
                            hasRightAddon: !!rightAddonProps.addon,
                        }),
                        className,
                    )}
                    ref={ref}
                    {...(rest as any)}
                />
                {rightIconProps.icon && (
                    <div className="absolute right-3 flex items-center pointer-events-none">
                        {rightIconProps.icon}
                    </div>
                )}
                {rightAddonProps.addon && <div className="flex-none">{rightAddonProps.addon}</div>}
            </div>
        )
    },
)
Input.displayName = "Input"

export { Input, hiddenInputStyles }
export { InputIcon, InputAddon, InputContainer, InputAnatomy, extractInputPartProps } from "./input-parts"
export type { InputStyling } from "./input-parts"
