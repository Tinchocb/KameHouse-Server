import { IconUiTrash, IconUiPlus } from "@/components/ui/icons";
import { DirectorySelector, DirectorySelectorProps } from "@/components/shared/directory-selector"
import { Button, IconButton } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import React, { forwardRef, useMemo } from "react"
import { Controller, FormState, get, useController, useFormContext } from "react-hook-form"

import { Checkbox, CheckboxGroup, CheckboxGroupProps, CheckboxProps } from "../checkbox"
import { RadioGroup, RadioGroupProps } from "../radio-group"
import { Select, SelectProps } from "../select"
import { Switch, SwitchProps } from "../switch"
import { TextInput, TextInputProps } from "../text-input"
import { useFormSchema } from "./form"
import { createPolymorphicComponent } from "./polymorphic-component"
import { SubmitField } from "./submit-field"


/**
 * Add the BasicField types to any Field
 */
export type FieldBaseProps = Omit<BasicFieldOptions, "name"> & {
    name: string
    onChange?: (...event: unknown[]) => void
    onBlur?: (...event: unknown[]) => void
    required?: boolean
}

import { BasicFieldOptions } from "../basic-field"

export type FieldComponent<T> = T & FieldBaseProps

export type FieldProps = React.ComponentPropsWithRef<"div">

/**
 * @description This wrapper makes it easier to work with custom form components by controlling their state.
 */
export function withControlledInput<T extends FieldBaseProps>(InputComponent: React.FC<T>) {
    const ControlledComponent = forwardRef<FieldProps, T>(
        (inputProps, ref) => {
            const { control, formState } = useFormContext()
            useFormSchema()

            return (
                <Controller
                    name={inputProps.name}
                    control={control}
                    rules={{ required: inputProps.required }}
                    render={({ field: { ref: _ref, ...field } }) => (
                        <InputComponent
                            value={field.value}
                            onChange={callAllHandlers(inputProps.onChange, field.onChange)}
                            onBlur={callAllHandlers(inputProps.onBlur, field.onBlur)}
                            {...(inputProps as T)}
                            error={getFormError(field.name, formState)?.message}
                            ref={mergeRefs(ref, _ref)}
                        />
                    )}
                />
            )
        },
    )
    ControlledComponent.displayName = `WithControlledInput(${InputComponent.displayName || InputComponent.name || "Component"})`
    return ControlledComponent
}

const TextInputFieldInner = forwardRef<HTMLInputElement, FieldComponent<TextInputProps>>(
    (props, ref) => {
        return <TextInput
            {...props}
            value={props.value ?? ""}
            ref={ref}
        />
    },
)
TextInputFieldInner.displayName = "TextInputField"
const TextInputField = React.memo(withControlledInput(TextInputFieldInner))

const SelectFieldInner = forwardRef<HTMLButtonElement, FieldComponent<SelectProps>>(
    ({ onChange, ...props }, ref) => {
        return <Select
            {...props}
            onValueChange={onChange}
            ref={ref}
        />
    },
)
SelectFieldInner.displayName = "SelectField"
const SelectField = React.memo(withControlledInput(SelectFieldInner))

const SwitchFieldInner = forwardRef<HTMLButtonElement, FieldComponent<SwitchProps>>(
    ({ onChange, ...props }, ref) => {
        return <Switch
            {...props}
            onValueChange={onChange}
            ref={ref}
        />
    },
)
SwitchFieldInner.displayName = "SwitchField"
const SwitchField = React.memo(withControlledInput(SwitchFieldInner))

const CheckboxFieldInner = forwardRef<HTMLButtonElement, FieldComponent<CheckboxProps>>(
    ({ onChange, ...props }, ref) => {
        return <Checkbox
            {...props}
            onValueChange={onChange}
            ref={ref}
        />
    },
)
CheckboxFieldInner.displayName = "CheckboxField"
const CheckboxField = React.memo(withControlledInput(CheckboxFieldInner))

const CheckboxGroupFieldInner = forwardRef<HTMLInputElement, FieldComponent<CheckboxGroupProps>>(
    ({ onChange, ...props }, ref) => {
        return <CheckboxGroup
            {...props}
            onValueChange={onChange}
            ref={ref}
        />
    },
)
CheckboxGroupFieldInner.displayName = "CheckboxGroupField"
const CheckboxGroupField = React.memo(withControlledInput(CheckboxGroupFieldInner))


const RadioGroupFieldInner = forwardRef<HTMLButtonElement, FieldComponent<RadioGroupProps>>(
    ({ onChange, ...props }, ref) => {
        return <RadioGroup
            {...props}
            onValueChange={onChange}
            ref={ref}
        />
    },
)
RadioGroupFieldInner.displayName = "RadioGroupField"
const RadioGroupField = React.memo(withControlledInput(RadioGroupFieldInner))


const RadioCardsFieldInner = forwardRef<HTMLButtonElement, FieldComponent<RadioGroupProps>>(
    ({ onChange, itemContainerClass, itemClass, ...props }, ref) => {
        return <RadioGroup
            itemContainerClass={cn(
                "items-start cursor-pointer transition border-transparent rounded-none p-3 w-full md:w-fit",
                "bg-transparent hover:bg-surface-container",
                "data-[state=checked]:bg-surface-container-high",
                "focus:ring-0 ring-offset-0 transition",
                "border data-[state=checked]:border-outline-variant",
                itemContainerClass,
            )}
            itemClass={cn(
                "border-transparent absolute top-2 right-2 bg-transparent",
                "data-[state=unchecked]:bg-transparent",
                "focus-visible:ring-0",
                itemClass,
            )}
            itemIndicatorClass="hidden"
            itemLabelClass="font-medium flex flex-col items-center data-[state=checked]:text-on-surface text-on-surface-variant cursor-pointer"
            {...props}
            onValueChange={onChange}
            stackClass="flex flex-col md:flex-row gap-2 space-y-0"
            ref={ref}
        />
    },
)
RadioCardsFieldInner.displayName = "RadioCardsField"

const RadioCardsField = React.memo(withControlledInput(RadioCardsFieldInner))


type DirectorySelectorFieldProps = Omit<DirectorySelectorProps, "onSelect" | "value"> & { value?: string }

const DirectorySelectorFieldInner = forwardRef<HTMLInputElement, FieldComponent<DirectorySelectorFieldProps>>(
    ({ value, onChange: _onChange, shouldExist, ...props }, ref) => {
        const context = useFormContext()
        const controller = useController({ name: props.name })

        const defaultValue = useMemo(() => get(context.formState.defaultValues, props.name) ?? "", [context.formState.defaultValues, props.name])

        React.useEffect(() => {
            controller.field.onChange(defaultValue)
        }, [defaultValue, controller.field])

        return <DirectorySelector
            shouldExist={shouldExist}
            {...props}
            value={value ?? ""}
            defaultValue={defaultValue}
            onSelect={value => controller.field.onChange(value)}
            ref={ref}
        />
    },
)
DirectorySelectorFieldInner.displayName = "DirectorySelectorField"

const DirectorySelectorField = React.memo(withControlledInput(DirectorySelectorFieldInner))

type MultiDirectorySelectorFieldProps = Omit<DirectorySelectorProps, "onSelect" | "value"> & { value?: string[] }

const MultiDirectorySelectorFieldInner = forwardRef<HTMLInputElement, FieldComponent<MultiDirectorySelectorFieldProps>>(
    ({ value: _value = [], onChange: _onChange, shouldExist, label, help, ...props }, ref) => {
        const paths = _value ?? []

        return <div className="space-y-2">
            <div>
                {label && <label className="block text-md font-bold text-on-surface uppercase tracking-wider">{label}</label>}
                {help && <p className="text-sm text-on-surface-variant">{help}</p>}
            </div>
            {paths.map((v, i) => (
                <div className="flex items-center gap-2" key={i}>
                    <div className="w-full">
                        <DirectorySelector
                            shouldExist={shouldExist}
                            {...props}
                            label={paths.length > 1 ? `Carpeta ${i + 1}` : undefined}
                            value={v ?? ""}
                            defaultValue={v ?? ""}
                            onSelect={value => {
                                const newPaths = [...paths]
                                newPaths[i] = value
                                _onChange?.(newPaths)
                            }}
                            ref={ref}
                            fieldClass="w-full"
                        />
                    </div>
                    <IconButton
                        size="sm"
                        intent="alert-outline"
                        icon={<IconUiTrash />}
                        title="Eliminar carpeta"
                        onClick={() => _onChange?.(paths.filter((_, index) => index !== i))}
                    />
                </div>
            ))}
            <Button
                size="sm"
                type="button"
                intent="secondary"
                leftIcon={<IconUiPlus />}
                className="text-xs rounded-xl"
                onClick={() => _onChange?.([...paths, ""])}
            >
                Añadir otra carpeta
            </Button>
        </div>
    },
)
MultiDirectorySelectorFieldInner.displayName = "MultiDirectorySelectorField"

const MultiDirectorySelectorField = React.memo(withControlledInput(MultiDirectorySelectorFieldInner))

export const Field = createPolymorphicComponent<"div", FieldProps, {
    Text: typeof TextInputField,
    Select: typeof SelectField,
    Switch: typeof SwitchField,
    Checkbox: typeof CheckboxField,
    CheckboxGroup: typeof CheckboxGroupField,
    RadioGroup: typeof RadioGroupField,
    DirectorySelector: typeof DirectorySelectorField,
    MultiDirectorySelector: typeof MultiDirectorySelectorField,
    RadioCards: typeof RadioCardsField,
    Submit: typeof SubmitField
}>({
    Text: TextInputField,
    Select: SelectField,
    Switch: SwitchField,
    Checkbox: CheckboxField,
    CheckboxGroup: CheckboxGroupField,
    RadioGroup: RadioGroupField,
    DirectorySelector: DirectorySelectorField,
    MultiDirectorySelector: MultiDirectorySelectorField,
    RadioCards: RadioCardsField,
    Submit: SubmitField,
})

Field.displayName = "Field"

/* -------------------------------------------------------------------------------------------------
 * Utils
 * -----------------------------------------------------------------------------------------------*/

export const getFormError = (name: string, formState: FormState<Record<string, unknown>>) => {
    return get(formState.errors, name)
}

export type ReactRef<T> = React.RefCallback<T> | React.MutableRefObject<T>

export function assignRef<T = unknown>(
    ref: ReactRef<T> | null | undefined,
    value: T,
) {
    if (ref == null) return

    if (typeof ref === "function") {
        ref(value)
        return
    }

    try {
        ref.current = value
    }
    catch {
        throw new Error(`Cannot assign value '${value}' to ref '${ref}'`)
    }
}

export function mergeRefs<T>(...refs: (ReactRef<T> | null | undefined)[]) {
    return (node: T | null) => {
        refs.forEach((ref) => {
            assignRef(ref, node)
        })
    }
}

export function useMergeRefs<T>(...refs: (ReactRef<T> | null | undefined)[]) {
    return useMemo(() => mergeRefs(...refs), [refs])
}

function callAllHandlers<T extends (...args: unknown[]) => unknown>(
    ...fns: (T | undefined)[]
) {
    return function func(...args: Parameters<T>) {
        fns.some((fn) => {
            fn?.(...args)
            return (args[0] as { defaultPrevented?: boolean } | undefined)?.defaultPrevented
        })
    }
}
