import { act, fireEvent, render, screen } from "@testing-library/react"
import { LazyMotion, domMax } from "framer-motion"
import { describe, expect, it, vi } from "vitest"
import { TimelineVolumeCard } from "./TimelineVolumeCard"
import { SPAN_VOLUMES } from "./data/spansToVolumes"

vi.mock("./EpisodeThumbnailImg", () => ({ EpisodeThumbnailImg: () => <span /> }))

describe("tarjeta compacta de cronología", () => {
    it("selección y play son botones independientes; el teclado del play no selecciona la tarjeta", () => {
        const volume = { ...SPAN_VOLUMES[0], mediaId: 1 }
        const onFocusCard = vi.fn()
        const onPlayVolume = vi.fn()
        render(<LazyMotion features={domMax}>
            <TimelineVolumeCard volume={volume} isRead={false} isFocused={false}
                onFocusCard={onFocusCard} onPlayVolume={onPlayVolume} />
        </LazyMotion>)
        const select = screen.getByRole("button", { name: `Seleccionar ${volume.title} en la línea de tiempo` })
        const play = screen.getByRole("button", { name: /^Reproducir/ })
        expect(select).not.toContainElement(play)
        act(() => play.focus())
        expect(fireEvent.keyDown(play, { key: "Enter" })).toBe(true)
        fireEvent.click(play) // Activación nativa tras Enter; happy-dom no sintetiza este clic.
        expect(onPlayVolume).toHaveBeenCalledTimes(1)
        expect(onFocusCard).not.toHaveBeenCalled()
        fireEvent.click(select)
        expect(onFocusCard).toHaveBeenCalledWith(volume.id)
        expect(select.closest("article")).toHaveFocus()
    })
})
