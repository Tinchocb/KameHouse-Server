import { describe, expect, it } from "vitest"
import { useQueueStore } from "./queue-store"
import { useUIStore } from "./ui-store"

function resetStores() {
    useQueueStore.setState({
        playlistQueue: [],
        currentQueueIndex: -1,
        activeQueuePlayItem: null,
        queueOpenSignal: 0,
    })
    useUIStore.setState({ globalQueueOpen: false })
}

describe("queue-store addToQueue", () => {
    it("agrega el item y emite la señal de apertura (sin importar el ui-store)", () => {
        resetStores()
        const before = useQueueStore.getState().queueOpenSignal
        useQueueStore.getState().addToQueue({
            id: 1,
            title: "EP 1",
            playableUrl: "/v/1.mp4",
            mediaId: 1,
            episodeNumber: 1,
        })
        const state = useQueueStore.getState()
        expect(state.playlistQueue).toHaveLength(1)
        expect(state.queueOpenSignal).toBe(before + 1)
    })

    it("no duplica items pero mantiene la señal de apertura", () => {
        resetStores()
        const item = { id: 1, title: "EP 1", playableUrl: "/v/1.mp4", mediaId: 1, episodeNumber: 1 }
        useQueueStore.getState().addToQueue(item)
        useQueueStore.getState().addToQueue(item)
        const state = useQueueStore.getState()
        expect(state.playlistQueue).toHaveLength(1)
        expect(state.queueOpenSignal).toBe(2)
    })

    it("la suscripción del ui-store abre el sidebar al agregar (integración)", () => {
        resetStores()
        expect(useUIStore.getState().globalQueueOpen).toBe(false)
        useQueueStore.getState().addToQueue({
            id: 9,
            title: "EP 9",
            playableUrl: "/v/9.mp4",
            mediaId: 9,
            episodeNumber: 9,
        })
        expect(useUIStore.getState().globalQueueOpen).toBe(true)
    })
})
