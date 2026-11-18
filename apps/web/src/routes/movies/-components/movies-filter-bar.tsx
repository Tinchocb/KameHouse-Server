import * as React from "react"
import { m } from "framer-motion"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { IconArrowDownUp, IconNavigationChevronDown } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import { Popover } from "@/components/ui/popover/popover"
import { cn } from "@/components/ui/core/styling"
import { SortOption, SORT_OPTIONS } from "./movies-utils"

interface MoviesFilterBarProps {
    sortBy: SortOption
    setSortBy: (sort: SortOption) => void
}

/** Menú desplegable de una sola elección (Orden): comparte cierre por clic fuera y Esc. */
function ChoiceMenu<T extends string | number>({
    label,
    icon,
    current,
    shortLabel,
    options,
    onChange,
}: {
    label: string
    icon?: React.ReactNode
    current: T
    shortLabel: string
    options: { value: T; label: string }[]
    onChange: (value: T) => void
}) {
    const [open, setOpen] = React.useState(false)
    const optionRefs = React.useRef<(HTMLButtonElement | null)[]>([])
    const reduceMotion = useReducedMotion()
    const currentLabel = options.find((o) => o.value === current)?.label ?? shortLabel

    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            modal={false}
            align="end"
            sideOffset={6}
            className="w-60 max-w-[calc(100vw-2rem)] rounded-2xl p-1.5"
            aria-label={label}
            onOpenAutoFocus={(event) => {
                event.preventDefault()
                const selectedIndex = options.findIndex((option) => option.value === current)
                optionRefs.current[Math.max(0, selectedIndex)]?.focus()
            }}
            onKeyDown={(event) => {
                const index = optionRefs.current.findIndex((option) => option === document.activeElement)
                let next: number
                if (event.key === "ArrowDown") next = (index + 1) % options.length
                else if (event.key === "ArrowUp") next = (index - 1 + options.length) % options.length
                else if (event.key === "Home") next = 0
                else if (event.key === "End") next = options.length - 1
                else return
                event.preventDefault()
                optionRefs.current[next]?.focus()
            }}
            trigger={
                <Button
                    intent="glass"
                    aria-label={`${label}: ${currentLabel}`}
                    iconSpacing="0.375rem"
                    leftIcon={icon}
                    rightIcon={
                        <m.span animate={{ rotate: open ? 180 : 0 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.15 }}>
                            <IconNavigationChevronDown className="w-3.5 h-3.5 text-on-surface-variant" />
                        </m.span>
                    }
                    className="[@media(pointer:coarse)]:min-h-[44px]"
                >
                    <span className="hidden md:inline">{currentLabel}</span>
                    <span className="md:hidden">{shortLabel}</span>
                </Button>
            }
        >
            <div role="group" aria-label={label}>
                {options.map((opt, index) => (
                    <button type="button"
                        key={String(opt.value)}
                        ref={(node) => { optionRefs.current[index] = node }}

                        aria-pressed={current === opt.value}
                        onClick={() => {
                            onChange(opt.value)
                            setOpen(false)
                        }}
                        className={cn(
                            "w-full flex min-h-11 items-center justify-between gap-2 px-3 rounded-xl type-label text-left outline-none transition-[background-color,color,transform] duration-fast ease-out-strong cursor-pointer motion-reduce:transition-none motion-safe:active:scale-[0.97]",
                            "focus-visible:ring-2 focus-visible:ring-brand-accent",
                            current === opt.value
                                ? "bg-[var(--selected-bg)] text-[var(--selected-fg)]"
                                : "text-on-surface [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[var(--neutral-elev-3)]"
                        )}
                    >
                        <span>{opt.label}</span>
                        {current === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-[var(--selected-fg)]" />}
                    </button>
                ))}
            </div>
        </Popover>
    )
}

export const MoviesFilterBar = React.memo(function MoviesFilterBar({
    sortBy,
    setSortBy,
}: MoviesFilterBarProps) {
    return (
        <ChoiceMenu<SortOption>
            label="Ordenar por"
            icon={<IconArrowDownUp className="w-3.5 h-3.5 text-on-surface-variant" />}
            current={sortBy}
            shortLabel="Orden"
            options={SORT_OPTIONS}
            onChange={setSortBy}
        />
    )
})
