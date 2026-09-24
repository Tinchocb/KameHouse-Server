import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"
import { SeekBar } from "./seek-bar"

describe("SeekBar component", () => {
    const defaultProps = {
        duration: 1420,
        progressBarRef: { current: null },
        thumbRef: { current: null },
        progressInputRef: { current: null },
        handleSeek: vi.fn(),
        handleSeekStart: vi.fn(),
        handleSeekEnd: vi.fn(),
        chapters: [
            { startTime: 120, endTime: 240, name: "Opening" },
            { startTime: 600, endTime: 900, name: "Escena Principal" },
        ],
        skipTimesOp: { startTime: 120, endTime: 210, source: "aniskip" },
        skipTimesEd: { startTime: 1300, endTime: 1390, source: "aniskip" },
    }

    it("renders timeline input with proper accessible attributes", () => {
        render(<SeekBar {...defaultProps} />)
        const slider = screen.getByRole("slider", { name: /línea de tiempo/i })
        expect(slider).toBeInTheDocument()
        expect(slider).toHaveAttribute("min", "0")
        expect(slider).toHaveAttribute("max", "1420")
        expect(slider).toHaveAttribute("aria-valuetext", "Posición actual de 23:40")
    })

    it("triggers handleSeek on range change", () => {
        const handleSeek = vi.fn()
        render(<SeekBar {...defaultProps} handleSeek={handleSeek} />)
        const slider = screen.getByRole("slider", { name: /línea de tiempo/i })
        fireEvent.change(slider, { target: { value: "300" } })
        expect(handleSeek).toHaveBeenCalled()
    })

    it("renders chapter ticks and skip segment markers", () => {
        const { container } = render(<SeekBar {...defaultProps} />)
        // Chapter ticks are rendered as absolute dividers
        expect(container.querySelectorAll("[data-marker=chapter]").length).toBe(2)
        // Skip markers (OP and ED)
        expect(container.querySelector("[data-marker=op]")).toBeInTheDocument()
        expect(container.querySelector("[data-marker=ed]")).toBeInTheDocument()
    })

    it("handles zero duration gracefully", () => {
        render(<SeekBar {...defaultProps} duration={0} chapters={[]} skipTimesOp={undefined} skipTimesEd={undefined} />)
        const slider = screen.getByRole("slider", { name: /línea de tiempo/i })
        expect(slider).toHaveAttribute("aria-valuetext", "0:00")
    })

    it("solo las teclas de navegación inician y terminan el seek", () => {
        const handleSeekStart = vi.fn()
        const handleSeekEnd = vi.fn()
        render(<SeekBar {...defaultProps} handleSeekStart={handleSeekStart} handleSeekEnd={handleSeekEnd} />)
        const slider = screen.getByRole("slider", { name: /línea de tiempo/i })

        fireEvent.keyDown(slider, { key: "Tab" })
        fireEvent.keyUp(slider, { key: " " })
        expect(handleSeekStart).not.toHaveBeenCalled()
        expect(handleSeekEnd).not.toHaveBeenCalled()

        fireEvent.keyDown(slider, { key: "ArrowRight" })
        fireEvent.keyUp(slider, { key: "ArrowRight" })
        expect(handleSeekStart).toHaveBeenCalledTimes(1)
        expect(handleSeekEnd).toHaveBeenCalledTimes(1)
    })

    it("suelta el foco al terminar un seek con el mouse", () => {
        render(<SeekBar {...defaultProps} />)
        const slider = screen.getByRole("slider", { name: /línea de tiempo/i })
        slider.focus()
        expect(slider).toHaveFocus()
        fireEvent.mouseUp(slider)
        expect(slider).not.toHaveFocus()
    })
})
