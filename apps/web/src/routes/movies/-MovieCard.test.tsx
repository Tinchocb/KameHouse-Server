import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const fetchAnimeEntry = vi.hoisted(() => vi.fn())
const addToQueue = vi.hoisted(() => vi.fn())

vi.mock("@/api/hooks/anime_entries.hooks", () => ({ fetchAnimeEntry }))
vi.mock("@/hooks/use-prefetch-anime-entry", () => ({ usePrefetchAnimeEntry: () => () => {} }))
vi.mock("@/hooks/use-responsive", () => ({ useResponsive: () => ({ isMobile: false }) }))
vi.mock("@/hooks/use-sound", () => ({ useSound: () => ({ playSound: () => {} }) }))
vi.mock("@/lib/theme/theme-hooks", () => ({ useHideAudienceScore: () => false }))
vi.mock("@/lib/store", () => ({ useQueueStore: { getState: () => ({ addToQueue }) } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/vaul", () => ({ Vaul: () => null, VaulContent: () => null }))
vi.mock("@/components/shared/deferred-image", () => ({ DeferredImage: () => null }))

import { MovieCard } from "./-MovieCard"

const entry = {
    mediaId: 7,
    media: { id: 7, title: { userPreferred: "Dragon Ball Z: Bardock" }, format: "MOVIE", year: 1990 },
    libraryData: { mainFileCount: 1 },
} as never

describe("MovieCard (teclado)", () => {
    it("deja una sola parada de Tab y añade a Mi Lista con Q", async () => {
        fetchAnimeEntry.mockResolvedValue({ localFiles: [{ path: "a.mkv", parsedInfo: { episode: 1 } }] })
        const onClick = vi.fn()
        const { container } = render(<MovieCard entry={entry} era="all" initial={false} onClick={onClick} onHoverCard={() => {}} />)
        const tabbable = Array.from(container.querySelectorAll("button")).filter(b => b.tabIndex >= 0)
        expect(tabbable).toHaveLength(1)
        expect(screen.getByRole("button", { name: "Añadir a Mi Lista" }).tabIndex).toBe(-1)
        fireEvent.keyDown(tabbable[0], { key: "q" })
        await vi.waitFor(() => expect(addToQueue).toHaveBeenCalledTimes(1))
    })
})
