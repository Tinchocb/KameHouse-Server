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
        ] = extractInputPartProps(props as unknown as Record<string, unknown>)

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
            size,
            intent,
            hasError,
            leftAddon: _leftAddon,
            leftIcon: _leftIcon,
            rightAddon: _rightAddon,
            rightIcon: _rightIcon,
            ...rest
        } = partProps as Record<string, unknown>

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
                            size: size as InputStyling["size"],
                            intent: intent as InputStyling["intent"],
                            hasError: hasError as boolean,
                            isDisabled: props.disabled,
                            hasLeftIcon: !!leftIconProps.icon,
                            hasRightIcon: !!rightIconProps.icon,
                            hasLeftAddon: !!leftAddonProps.addon,
                            hasRightAddon: !!rightAddonProps.addon,
                        }),
                        className,
                    )}
                    ref={ref}
                    {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
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
