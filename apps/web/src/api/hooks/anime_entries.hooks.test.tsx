import type { PropsWithChildren } from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vitest"
import { useGetAnimeEntry } from "./anime_entries.hooks"

it("actualiza una ficha abierta cuando llegan las sinopsis e imágenes", async () => {
    const cold = { episodes: [{ episodeNumber: 1, episodeMetadata: { title: "Episodio" } }] }
    const enriched = { episodeEnrichmentPending: false, episodes: [{ episodeNumber: 1, episodeMetadata: {
        title: "Episodio", overview: "Sinopsis del episodio",
    } }] }
    const fetchMock = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: cold })))
        .mockImplementation(async () => new Response(JSON.stringify({ data: enriched })))
    vi.stubGlobal("fetch", fetchMock)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const view = renderHook(() => useGetAnimeEntry(12971), { wrapper })
    try {
        await waitFor(() => expect(view.result.current.data?.episodes?.[0]?.episodeMetadata?.overview).toBe("Sinopsis del episodio"), { timeout: 4000 })
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fetchMock.mock.calls.every(call => (call[1] as RequestInit).cache === "no-store")).toBe(true)
        // Once complete, another polling interval must not fetch again.
        await new Promise(resolve => setTimeout(resolve, 2200))
        expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
        view.unmount()
        client.clear()
        vi.unstubAllGlobals()
    }
}, 10000)
