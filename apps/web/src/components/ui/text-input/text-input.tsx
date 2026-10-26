import { IconUiEyeOff, IconUiEye } from "@/components/ui/icons";
import { IconSwap } from "@/components/ui/kinetics";
import { cn } from "../core/styling"
import * as React from "react"
import { BasicField, BasicFieldOptions, extractBasicFieldProps } from "../basic-field"
import { extractInputPartProps, InputAddon, InputAnatomy, InputContainer, InputIcon, InputStyling } from "../input/input-parts"


/* -------------------------------------------------------------------------------------------------
 * TextInput
 * -----------------------------------------------------------------------------------------------*/

export type TextInputProps = Omit<React.ComponentPropsWithRef<"input">, "size"> &
    InputStyling &
    BasicFieldOptions & {
    onValueChange?: (value: string) => void
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>((props, ref) => {

    const [props1, basicFieldProps] = extractBasicFieldProps<TextInputProps>(props, React.useId())

    const [{
        size,
        intent,
        leftAddon,
        leftIcon,
        rightAddon,
        rightIcon,
        className,
        onValueChange,
        onChange,
        type,
        ...rest
    }, {
        inputContainerProps,
        leftAddonProps,
        leftIconProps,
        rightAddonProps,
        rightIconProps,
    }] = extractInputPartProps<TextInputProps>({
        ...props1,
        size: props1.size ?? "md",
        intent: props1.intent ?? "basic",
        leftAddon: props1.leftAddon,
        leftIcon: props1.leftIcon,
        rightAddon: props1.rightAddon,
        rightIcon: props1.rightIcon,
    })

    const [showPassword, setShowPassword] = React.useState(false)
    const isPasswordInput = type === "password"
    const actualType = isPasswordInput ? (showPassword ? "text" : "password") : type

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onValueChange?.(e.target.value)
        onChange?.(e)
    }

    const togglePasswordVisibility = React.useCallback(() => {
        setShowPassword(prev => !prev)
    }, [])

    const finalRightAddon = isPasswordInput ? (
        <button
            type="button"
            onClick={togglePasswordVisibility}
            aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
            className="cursor-pointer text-label-2 hover:text-on-surface active:scale-90 transition-[color,transform] duration-fast ease-out-strong p-1 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-accent flex items-center justify-center"
        >
            <IconSwap swapKey={showPassword ? "hide" : "show"}>
                {showPassword ? <IconUiEyeOff className="w-4 h-4" /> : <IconUiEye className="w-4 h-4" />}
            </IconSwap>
        </button>
    ) : rightAddon

    return (
        <BasicField{...basicFieldProps}>
            <InputContainer {...inputContainerProps}>
                <InputAddon {...leftAddonProps} />
                <InputIcon {...leftIconProps} />

                <input
                    id={basicFieldProps.id}
                    name={basicFieldProps.name}
                    type={actualType}
                    className={cn(
                        "form-input",
                        InputAnatomy.root({
                            size,
                            intent,
                            hasError: !!basicFieldProps.error,
                            isDisabled: !!basicFieldProps.disabled,
                            isReadonly: !!basicFieldProps.readonly,
                            hasRightAddon: !!rightAddon || isPasswordInput,
                            hasRightIcon: !!rightIcon,
                            hasLeftAddon: !!leftAddon,
                            hasLeftIcon: !!leftIcon,
                        }),
                        // El variante isReadonly de InputAnatomy trae pointer-events-none: sin esto no se
                        // puede seleccionar ni copiar con el mouse. Un readonly es texto copiable.
                        basicFieldProps.readonly && "pointer-events-auto cursor-text",
                        className,
                    )}
                    disabled={basicFieldProps.disabled}
                    readOnly={basicFieldProps.readonly}
                    data-disabled={basicFieldProps.disabled}
                    data-readonly={basicFieldProps.readonly}
                    aria-readonly={basicFieldProps.readonly}
                    required={basicFieldProps.required}
                    onChange={handleOnChange}
                    {...rest}
                    ref={ref}
                />

                <InputAddon {...rightAddonProps} addon={finalRightAddon} />
                <InputIcon {...rightIconProps} />
            </InputContainer>
        </BasicField>
    )

})

TextInput.displayName = "TextInput"
