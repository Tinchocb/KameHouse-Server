import { fireEvent, render, screen } from "@testing-library/react"
import { LazyMotion, domAnimation } from "framer-motion"
import { describe, expect, it, vi } from "vitest"
import type { PremiumEpisode } from "@/api/types/series.types"
import { PremiumEpisodeList } from "./premium-episode-list"

const loading = vi.hoisted(() => ({ pending: true }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))
vi.mock("@/lib/theme/theme-hooks", () => ({ useThemeSettings: () => ({}) }))
vi.mock("../-hooks/use-saga-episodes-ready", () => ({
    useSagaEpisodesReady: (episodes: PremiumEpisode[]) => ({ episodes, pending: loading.pending }),
}))
vi.mock("@tanstack/react-virtual", () => ({
    useVirtualizer: (options: { count: number }) => ({
        options: { scrollMargin: 0 },
        getTotalSize: () => 180,
        getVirtualItems: () => Array.from({ length: options.count }, (_, index) => ({ index, start: index * 180 })),
        measureElement: () => {},
        scrollToIndex: () => {},
    }),
}))

describe("episodios retenidos al cambiar de saga", () => {
    it("impide reproducir la lista anterior y vuelve a habilitarla cuando está lista", () => {
        loading.pending = true
        const onPlay = vi.fn()
        const episodes: PremiumEpisode[] = [{
            id: "1", number: 1, title: "Prueba", description: "", thumbnailUrl: "",
            episodeType: "Canon", isWatched: false,
        }]
        const view = () => <LazyMotion features={domAnimation}>
            <PremiumEpisodeList episodes={episodes} onPlay={onPlay} activeSagaId={loading.pending ? "waiting" : "ready"} />
        </LazyMotion>
        const { rerender } = render(view())
        const play = screen.getByRole("button", { name: /Reproducir episodio 1/ })
        expect(play.closest("[inert]")).not.toBeNull()
        fireEvent.click(play) // Incluso una activación programática no debe ejecutar el callback viejo.
        expect(onPlay).not.toHaveBeenCalled()
        loading.pending = false
        rerender(view())
        expect(play.closest("[inert]")).toBeNull()
        fireEvent.click(play)
        expect(onPlay).toHaveBeenCalledWith(1)
    })
})
