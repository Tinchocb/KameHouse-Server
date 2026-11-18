import { IconUiCheck, IconUiSpinner } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"

/** Marca decorativa con espacio fijo: cambiar de opción no desplaza el texto. */
export function SelectionMark({ selected, pending = false }: { selected: boolean; pending?: boolean }) {
    return (
        <span aria-hidden="true" className="relative grid h-5 w-5 shrink-0 place-items-center text-brand-accent">
            <IconUiCheck
                data-selected={selected && !pending}
                className={cn(
                    "h-4 w-4 transition-[opacity,transform] duration-quick ease-smooth-out motion-reduce:transition-opacity",
                    selected && !pending ? "opacity-100 motion-safe:scale-100" : "opacity-0 motion-safe:scale-75",
                )}
            />
            {pending && <IconUiSpinner className="absolute h-4 w-4 animate-spin" />}
        </span>
    )
}
