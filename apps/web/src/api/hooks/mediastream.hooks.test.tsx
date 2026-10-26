import type { PropsWithChildren } from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { RequestMediastreamMediaContainer_Variables } from "@/api/generated/endpoint.types"
import { useRequestMediastreamMediaContainer } from "./mediastream.hooks"

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }))

type Variables = Partial<RequestMediastreamMediaContainer_Variables>
const base: Variables = { path: "/episode.mkv", streamType: "direct", clientID: "player-a", force: false, audioStreamIndex: 0 }
const clients: QueryClient[] = []

function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    clients.push(client)
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    return { client, wrapper }
}

describe("identidad de la preparación del stream", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            const variables = JSON.parse(String(init?.body)) as Variables
            return new Response(JSON.stringify({ data: {
                filePath: variables.path,
                hash: "episode-hash",
                streamType: "direct",
                streamUrl: `/stream?client=${variables.clientID}`,
                mediaInfo: {},
            } }), { status: 200 })
        }))
    })
    afterEach(() => {
        for (const client of clients) client.clear()
        clients.length = 0
        vi.unstubAllGlobals()
    })

    it("reutiliza la consulta para objetos equivalentes", async () => {
        const { client, wrapper } = setup()
        const view = renderHook(({ variables }) => useRequestMediastreamMediaContainer(variables, true), { wrapper, initialProps: { variables: base } })
        await waitFor(() => expect(view.result.current.isSuccess).toBe(true))
        view.rerender({ variables: { ...base } })
        await act(async () => {})
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(client.getQueryCache().getAll()).toHaveLength(1)
    })

    it.each<[string, Variables]>([
        ["cliente", { clientID: "player-b" }],
        ["audio", { audioStreamIndex: 1 }],
        ["force", { force: true }],
        ["capacidades", { clientCapabilities: { hevc: true, hevc10Bit: false, av1: false, vp9: false, ac3: false, eac3: false, dts: false, matroska: false } }],
    ])("prepara otra sesión al cambiar %s", async (_label, patch) => {
        const { wrapper } = setup()
        const view = renderHook(({ variables }) => useRequestMediastreamMediaContainer(variables, true), { wrapper, initialProps: { variables: base } })
        await waitFor(() => expect(view.result.current.isSuccess).toBe(true))
        view.rerender({ variables: { ...base, ...patch } })
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(view.result.current.isSuccess).toBe(true))
        expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))).toEqual({ ...base, ...patch })
    })

    it("dos reproductores del mismo archivo reciben sesiones independientes", async () => {
        const { wrapper } = setup()
        const view = renderHook(() => ({
            first: useRequestMediastreamMediaContainer(base, true),
            second: useRequestMediastreamMediaContainer({ ...base, clientID: "player-b" }, true),
        }), { wrapper })
        await waitFor(() => {
            expect(view.result.current.first.data?.streamUrl).toBe("/stream?client=player-a")
            expect(view.result.current.second.data?.streamUrl).toBe("/stream?client=player-b")
        })
        expect(fetch).toHaveBeenCalledTimes(2)
    })

    it("vuelve a vincular la sesión tras desmontar y expulsar su caché", async () => {
        const { client, wrapper } = setup()
        const first = renderHook(() => useRequestMediastreamMediaContainer(base, true), { wrapper })
        await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
        first.unmount()
        await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(0))
        const second = renderHook(() => useRequestMediastreamMediaContainer(base, true), { wrapper })
        await waitFor(() => expect(second.result.current.isSuccess).toBe(true))
        expect(fetch).toHaveBeenCalledTimes(2)
    })
})
