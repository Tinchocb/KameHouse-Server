import { DirectorySelector, DirectorySelectorProps } from "@/components/shared/directory-selector"
import { IconButton } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import React, { forwardRef, useMemo } from "react"
import { Controller, FormState, get, useController, useFormContext } from "react-hook-form"
import { BiPlus, BiTrash } from "react-icons/bi"
import { Checkbox, CheckboxGroup, CheckboxGroupProps, CheckboxProps } from "../checkbox"
import { Combobox, ComboboxProps } from "../combobox"
import { NativeSelect, NativeSelectProps } from "../native-select"
import { NumberInput, NumberInputProps } from "../number-input"
import { RadioGroup, RadioGroupProps } from "../radio-group"
import { Select, SelectProps } from "../select"
import { Switch, SwitchProps } from "../switch"
import { TextInput, TextInputProps } from "../text-input"
import { Textarea, TextareaProps } from "../textarea"
import { useFormSchema } from "./form"
import { createPolymorphicComponent } from "./polymorphic-component"
import { SubmitField } from "./submit-field"


/**
 * Add the BasicField types to any Field
 */
export type FieldBaseProps = Omit<BasicFieldOptions, "name"> & {
    name: string
    onChange?: any
    onBlur?: any
    required?: boolean
}

import { BasicFieldOptions } from "../basic-field"

export type FieldComponent<T> = T & FieldBaseProps

export type FieldProps = React.ComponentPropsWithRef<"div">

/**
 * @description This wrapper makes it easier to work with custom form components by controlling their state.
 */
export function withControlledInput<T extends FieldBaseProps>(InputComponent: React.FC<T>) {
    return forwardRef<FieldProps, T>(
        (inputProps, ref) => {
            const { control, formState } = useFormContext()
            const { shape } = useFormSchema()

            /* Get the `required` status from the Schema */
            const required = useMemo(() => {
                return !!get(shape, inputProps.name) &&
                    !get(shape, inputProps.name)?.isOptional() &&
                    !get(shape, inputProps.name)?.isNullable()
            }, [shape])

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
                            {...inputProps as any}
                            error={getFormError(field.name, formState)?.message}
                            ref={useMergeRefs(ref, _ref)}
                        />
                    )}
                />
            )
        },
    )
}

const TextInputField = React.memo(withControlledInput(forwardRef<HTMLInputElement, FieldComponent<TextInputProps>>(
    (props, ref) => {
        return <TextInput
            {...props}
            value={props.value ?? ""}
            ref={ref}
        />
    },
)))

const TextareaField = React.memo(withControlledInput(forwardRef<HTMLTextAreaElement, FieldComponent<TextareaProps>>(
    (props, ref) => {
        return <Textarea
            {...props}
            value={props.value ?? ""}
            ref={ref}
        />
    },
)))

const NativeSelectField = React.memo(withControlledInput(forwardRef<HTMLSelectElement, FieldComponent<NativeSelectProps>>(
    (props, ref) => {
        const context = useFormContext()
        const controller = useController({ name: props.name })

        // Set the default value as the first option if no default value is passed and there is no placeholder
        React.useEffect(() => {
            if (!get(context.formState.defaultValues, props.name) && !controller.field.value && !props.placeholder) {
                controller.field.onChange(props.options?.[0]?.value)
            }
        }, [])

        return <NativeSelect
            {...props}
            ref={ref}
        />
    },
)))

const SelectField = React.memo(withControlledInput(forwardRef<HTMLButtonElement, FieldComponent<SelectProps>>(
    ({ onChange, ...props }, ref) => {
        return <Select
            {...props}
            onValueChange={onChange}
            ref={ref}
        />
    },
)))

const NumberField = React.memo(withControlledInput(forwardRef<HTMLInputElement, FieldComponent<NumberInputProps>>(
    ({ onChange, ...props }, ref) => {
        return <NumberInput
            {...props}
            onValueChange={onChange}
            ref={ref}
        />
    },
)))


const ComboboxField = React.memo(withControlledInput(forwardRef<HTMLButtonElement, FieldComponent<ComboboxProps>>(
    ({ onChange, ...props }, ref) => {
        return <Combobox
            {...props}
            onValueChange={onChange}
            ref={ref}
        />
    },
)))

const SwitchField = React.memo(withControlledInput(forwardRef<HTMLButtonElement, FieldComponent<SwitchProps>>(
    ({ onChange, ...props }, ref) => {
        return <Switch
            {...props}
            onValueChange={onChange}
            ref={ref}
        />
    },
)))

const CheckboxField = React.memo(withControlledInput(forwardRef<HTMLButtonElement, FieldComponent<CheckboxProps>>(
    ({ onChange, ...props }, ref) => {
        return <Checkbox
            {...props}
            onValueChange={onChange}
            ref={ref}
        />
    },
)))

const CheckboxGroupField = React.memo(withControlledInput(forwardRef<HTMLInputElement, FieldComponent<CheckboxGroupProps>>(
    ({ onChange, ...props }, ref) => {
        return <CheckboxGroup
            {...props}
            onValueChange={onChange}
            ref={ref}
        />
    },
)))


const RadioGroupField = React.memo(withControlledInput(forwardRef<HTMLButtonElement, FieldComponent<RadioGroupProps>>(
    ({ onChange, ...props }, ref) => {
        return <RadioGroup
            {...props}
            onValueChange={onChange}
            ref={ref}
        />
    },
)))


const RadioCardsField = React.memo(withControlledInput(forwardRef<HTMLButtonElement, FieldComponent<RadioGroupProps>>(
    ({ onChange, itemContainerClass, itemClass, ...props }, ref) => {
        return <RadioGroup
            itemContainerClass={cn(
                "items-start cursor-pointer transition border-transparent rounded-none p-3 w-full md:w-fit",
                "bg-transparent dark:hover:bg-gray-900 dark:bg-transparent",
                "data-[state=checked]:bg-white/5 dark:data-[state=checked]:bg-gray-900",
                "focus:ring-0 ring-offset-0 transition",
                "dark:border dark:data-[state=checked]:border-white/20",
                itemContainerClass,
            )}
            itemClass={cn(
                "border-transparent absolute top-2 right-2 bg-transparent",
                "data-[state=unchecked]:bg-transparent",
                "focus-visible:ring-0",
                itemClass,
            )}
            itemIndicatorClass="hidden"
            itemLabelClass="font-medium flex flex-col items-center data-[state=checked]:text-white text-zinc-500 cursor-pointer"
            {...props}
            onValueChange={onChange}
            stackClass="flex flex-col md:flex-row gap-2 space-y-0"
            ref={ref}
        />
    },
)))


type DirectorySelectorFieldProps = Omit<DirectorySelectorProps, "onSelect" | "value"> & { value?: string }

const DirectorySelectorField = React.memo(withControlledInput(forwardRef<HTMLInputElement, FieldComponent<DirectorySelectorFieldProps>>(
    ({ value, onChange, shouldExist, ...props }, ref) => {
        const context = useFormContext()
        const controller = useController({ name: props.name })

        const defaultValue = useMemo(() => get(context.formState.defaultValues, props.name) ?? "", [])

        React.useEffect(() => {
            controller.field.onChange(defaultValue)
        }, [])

        return <DirectorySelector
            shouldExist={shouldExist}
            {...props}
            value={value ?? ""}
            defaultValue={defaultValue}
            onSelect={value => controller.field.onChange(value)}
            ref={ref}
        />
    },
)))

type MultiDirectorySelectorFieldProps = Omit<DirectorySelectorProps, "onSelect" | "value"> & { value?: string[] }

const MultiDirectorySelectorField = React.memo(withControlledInput(forwardRef<HTMLInputElement, FieldComponent<MultiDirectorySelectorFieldProps>>(
    ({ value, onChange, shouldExist, label, help, ...props }, ref) => {
        const context = useFormContext()
        const controller = useController({ name: props.name })

        const [paths, setPaths] = React.useState<string[]>([])

        const defaultValue = useMemo(() => get(context.formState.defaultValues, props.name) ?? [], [])
        React.useEffect(() => {
            setPaths(defaultValue)
        }, [])


        React.useEffect(() => {
            controller.field.onChange(paths.filter(p => p))
        }, [paths])

        return <div className="space-y-2">
            <div>
                {label && <label className="block text-md font-bold text-white uppercase tracking-wider">{label}</label>}
                {help && <p className="text-sm text-zinc-500">{help}</p>}
            </div>
            {paths?.map((v, i) => (
                <div className="flex items-center gap-2" key={i}>
                    <div className="w-full">
                        <DirectorySelector
                            shouldExist={shouldExist}
                            {...props}
                            label="Directory"
                            value={v ?? ""}
                            defaultValue={v ?? ""}
                            onSelect={value => {
                                setPaths(prev => {
                                    const newPaths = [...prev]
                                    newPaths[i] = value
                                    return newPaths
                                })
                            }}
                            ref={ref}
                            fieldClass="w-full"
                        />
                    </div>
                    <IconButton
                        size="sm"
                        intent="alert-subtle"
                        icon={<BiTrash />}
                        onClick={() => setPaths(prev => prev.filter((_, index) => index !== i))}
                    />
                </div>
            ))}
            <IconButton
                size="sm"
                intent="gray-subtle"
                icon={<BiPlus />}
                onClick={() => setPaths(prev => [...prev, ""])}
            />
        </div>
    },
)))

export const Field = createPolymorphicComponent<"div", FieldProps, {
    Text: typeof TextInputField,
    Textarea: typeof TextareaField,
    Select: typeof SelectField,
    NativeSelect: typeof NativeSelectField,
    Switch: typeof SwitchField,
    Checkbox: typeof CheckboxField,
    CheckboxGroup: typeof CheckboxGroupField,
    RadioGroup: typeof RadioGroupField,
    Number: typeof NumberField,
    Combobox: typeof ComboboxField
    DirectorySelector: typeof DirectorySelectorField
    MultiDirectorySelector: typeof MultiDirectorySelectorField
    RadioCards: typeof RadioCardsField
    Submit: typeof SubmitField
}>({
    Text: TextInputField,
    Textarea: TextareaField,
    Select: SelectField,
    NativeSelect: NativeSelectField,
    Switch: SwitchField,
    Checkbox: CheckboxField,
    CheckboxGroup: CheckboxGroupField,
    RadioGroup: RadioGroupField,
    Number: NumberField,
    Combobox: ComboboxField,
    DirectorySelector: DirectorySelectorField,
    MultiDirectorySelector: MultiDirectorySelectorField,
    RadioCards: RadioCardsField,
    Submit: SubmitField,
})

Field.displayName = "Field"

/* -------------------------------------------------------------------------------------------------
 * Utils
 * -----------------------------------------------------------------------------------------------*/

export const getFormError = (name: string, formState: FormState<{ [x: string]: any }>) => {
    return get(formState.errors, name)
}

export type ReactRef<T> = React.RefCallback<T> | React.MutableRefObject<T>

export function assignRef<T = any>(
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
    catch (error) {
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
    return useMemo(() => mergeRefs(...refs), refs)
}

type Args<T extends Function> = T extends (...args: infer R) => any ? R : never

function callAllHandlers<T extends (event: any) => void>(
    ...fns: (T | undefined)[]
) {
    return function func(event: Args<T>[0]) {
        fns.some((fn) => {
            fn?.(event)
            return event?.defaultPrevented
        })
    }
}
