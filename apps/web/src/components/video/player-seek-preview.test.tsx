import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { PlayerSeekPreview } from "./player-seek-preview"
import type { PlayerPreviewManager } from "./player-preview"
vi.mock("@/components/ui/kinetics/hooks", () => ({ useSpringPreset: () => ({}), useReducedMotion: () => true }))
vi.mock("framer-motion", () => ({ m: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }, AnimatePresence: ({ children }: { children: React.ReactNode }) => children }))
function manager(load: ReturnType<typeof vi.fn>) {
    return { calculateSegmentIndex: (t: number) => Math.floor(t/10), retrievePreviewForSegment: load } as unknown as PlayerPreviewManager
}
describe("timeline storyboard UI", () => {
    it("shows preparation then a tile with the requested time", async () => {
        const load = vi.fn().mockResolvedValue({ url: "blob:sheet", column: 2, row: 1, columns: 4, rows: 3 })
        const { container } = render(<PlayerSeekPreview previewManager={manager(load)} hoverTime={60} hoverPosPercent={50} />)
        expect(screen.getByText("Preparando vista previa…")).toBeInTheDocument()
        await waitFor(() => expect(container.querySelector('[role="img"]')).not.toBeNull())
        expect(screen.getByText("01:00")).toBeInTheDocument()
        expect(container.querySelector<HTMLElement>('[role="img"]')?.style.backgroundPosition).toBe("66.66666666666666% 50%")
    })
    it("shows failure instead of an empty gray frame", async () => {
        const load = vi.fn().mockRejectedValue(new Error("failure"))
        const { container } = render(<PlayerSeekPreview previewManager={manager(load)} hoverTime={10} hoverPosPercent={0} />)
        await screen.findByText("Vista previa no disponible")
        expect(container.querySelector('[role="img"]')).toBeNull()
    })
    it("does not display a late image from the previous episode", async () => {
        const pending = Promise.withResolvers<never>()
        const first = manager(vi.fn().mockReturnValue(pending.promise))
        const second = manager(vi.fn().mockRejectedValue(new Error("unavailable")))
        const view = render(<PlayerSeekPreview previewManager={first} hoverTime={10} hoverPosPercent={50} />)
        await waitFor(() => expect(first.retrievePreviewForSegment).toHaveBeenCalled())
        view.rerender(<PlayerSeekPreview previewManager={second} hoverTime={10} hoverPosPercent={50} />)
        pending.reject(new Error("old error"))
        await screen.findByText("Vista previa no disponible")
        expect(view.container.querySelector('[role="img"]')).toBeNull()
    })
})
