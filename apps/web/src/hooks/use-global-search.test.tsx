import { act, cleanup, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider, useQuery, type QueryKey } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useGlobalSearch } from "./use-global-search"

const state = vi.hoisted(() => ({
    collection: {},
    entries: [{ mediaId: 1, media: { titleRomaji: "Goku", format: "TV" } }],
    readEntries: vi.fn(),
    timeline: vi.fn(() => []),
    request: vi.fn<(_q: string, _signal: AbortSignal) => Promise<[]>>(() => Promise.resolve([])),
}))
vi.mock("@/api/hooks/anime_collection.hooks", () => ({ useGetLibraryCollection: () => ({ data: state.collection, isLoading: false }) }))
vi.mock("@/api/hooks/unlinked.hooks", () => ({ useGetUnlinkedFiles: () => ({ data: [], isLoading: false }) }))
vi.mock("@/lib/helpers/collection", () => ({ getSafeCollectionEntries: () => { state.readEntries(); return state.entries } }))
vi.mock("@/components/chronology/data/timelineSearch", () => ({ searchTimeline: state.timeline }))
vi.mock("@/components/chronology/data/volumes", () => ({ VOLUMES_DATA: [] }))
vi.mock("@/api/client/requests", () => ({
    useServerQuery: (options: { queryKey: QueryKey; enabled: boolean; params: { q: string }; staleTime: number }) => useQuery({
        queryKey: options.queryKey, enabled: options.enabled, staleTime: options.staleTime,
        queryFn: ({ signal }) => state.request(options.params.q, signal),
    }),
}))

let client: QueryClient
function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider> }
beforeEach(() => {
    vi.useFakeTimers()
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    state.collection = {}
    state.request.mockReset().mockResolvedValue([])
    state.readEntries.mockClear()
    state.timeline.mockClear()
})
afterEach(() => { cleanup(); client.clear(); vi.useRealTimers() })
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(300) })

describe("closed search budget", () => {
    it("does no semantic requests or library/timeline work while closed", async () => {
        const view = renderHook(({ enabled }) => useGlobalSearch(enabled), { initialProps: { enabled: false }, wrapper: Wrapper })
        act(() => view.result.current.setQuery("goku"))
        state.collection = {}
        view.rerender({ enabled: false })
        await settle()
        expect(state.request).not.toHaveBeenCalled()
        expect(state.readEntries).not.toHaveBeenCalled()
        expect(state.timeline).not.toHaveBeenCalled()
        expect(view.result.current.results).toEqual([])
        expect(view.result.current.isSearchActive).toBe(false)
        expect(view.result.current.isLoading).toBe(false)
    })
    it("cancels the pending debounce and reopens with the latest preserved query", async () => {
        const view = renderHook(({ enabled }) => useGlobalSearch(enabled), { initialProps: { enabled: true }, wrapper: Wrapper })
        act(() => view.result.current.setQuery("goku"))
        view.rerender({ enabled: false })
        await settle()
        expect(state.request).not.toHaveBeenCalled()
        view.rerender({ enabled: true })
        await settle()
        expect(view.result.current.query).toBe("goku")
        expect(state.request).toHaveBeenCalledTimes(1)
        expect(state.request.mock.calls[0][0]).toBe("goku")
        expect(view.result.current.results.some(item => item.mediaId === 1)).toBe(true)
    })
    it("keeps semantic requests disabled in chronology and command modes", async () => {
        const view = renderHook(() => useGlobalSearch(), { wrapper: Wrapper })
        act(() => view.result.current.setQuery("@goku"))
        await settle()
        expect(view.result.current.isChronoMode).toBe(true)
        expect(state.timeline).toHaveBeenCalled()
        act(() => view.result.current.setQuery(">scan"))
        await settle()
        expect(view.result.current.isChronoMode).toBe(false)
        expect(state.request).not.toHaveBeenCalled()
    })
    it("closing one consumer does not abort a request shared by another open search", async () => {
        let finish: (items: []) => void = () => {}
        state.request.mockImplementation(() => new Promise(resolve => { finish = resolve }))
        const first = renderHook(({ enabled }) => useGlobalSearch(enabled), { initialProps: { enabled: true }, wrapper: Wrapper })
        const second = renderHook(() => useGlobalSearch(), { wrapper: Wrapper })
        act(() => { first.result.current.setQuery("goku"); second.result.current.setQuery("goku") })
        await settle()
        expect(state.request).toHaveBeenCalledTimes(1)
        first.rerender({ enabled: false })
        expect(state.request.mock.calls[0][1].aborted).toBe(false)
        await act(async () => { finish([]); await vi.advanceTimersByTimeAsync(0) })
        expect(first.result.current.results).toEqual([])
        expect(second.result.current.isSearchActive).toBe(true)
        expect(second.result.current.results.some(item => item.mediaId === 1)).toBe(true)
    })
})
