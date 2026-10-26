import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/api/hooks/anime_entries.hooks", () => ({ fetchAnimeEntry: vi.fn() }))
vi.mock("@/hooks/use-prefetch-anime-entry", () => ({ usePrefetchAnimeEntry: () => () => {} }))
vi.mock("@/hooks/use-responsive", () => ({ useResponsive: () => ({ isMobile: true }) }))
vi.mock("@/hooks/use-sound", () => ({ useSound: () => ({ playSound: () => {} }) }))
vi.mock("@/lib/theme/theme-hooks", () => ({
    useHideAudienceScore: () => false,
    useThemeSettings: () => ({ themeEnableBlurringEffects: false }),
}))
vi.mock("@/lib/store", () => ({ useQueueStore: { getState: () => ({ addToQueue: vi.fn() }) } }))
vi.mock("@/components/shared/deferred-image", () => ({ DeferredImage: () => null }))

import { MovieCard } from "./-MovieCard"

describe("MovieCard: diálogo móvil", () => {
    it("se nombra con el encabezado visible y conserva la acción de abrir la ficha", async () => {
        const onClick = vi.fn()
        const entry = {
            mediaId: 7,
            media: { id: 7, titleSpanish: "Bardock", posterImage: "/poster.png", format: "MOVIE", year: 1990 },
            libraryData: { mainFileCount: 1 },
        } as never
        render(<MovieCard entry={entry} era="all" initial={false} onClick={onClick} onHoverCard={() => {}} />)
        fireEvent.click(screen.getByRole("button", { name: "Más opciones" }))
        const dialog = await screen.findByRole("dialog", { name: "Bardock" })
        expect(dialog).toHaveAttribute("aria-labelledby", within(dialog).getByRole("heading", { name: "Bardock" }).id)
        expect(document.getElementById(dialog.getAttribute("aria-describedby") ?? "")).toBeInTheDocument()
        fireEvent.click(within(dialog).getByRole("button", { name: "Ver película" }))
        expect(onClick).toHaveBeenCalledExactlyOnceWith(7)
    })
})
