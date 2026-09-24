import { useState } from "react"


export function useBoolean(
    initialState: boolean,
    callbacks?: { onOpen?(): void; onClose?(): void },
) {
    const [opened, setOpened] = useState(initialState)

    const open = () => {
        if (!opened) {
            setOpened(true)
            callbacks?.onOpen?.()
        }
    }

    const close = () => {
        if (opened) {
            setOpened(false)
            callbacks?.onClose?.()
        }
    }

    return { active: opened, on: open, off: close, set: setOpened } as const
}
