import { useState } from "react"


export function useBoolean(initialState: boolean) {
    const [opened, setOpened] = useState(initialState)

    const open = () => {
        if (!opened) {
            setOpened(true)
        }
    }

    const close = () => {
        if (opened) {
            setOpened(false)
        }
    }

    return { active: opened, on: open, off: close, set: setOpened } as const
}
