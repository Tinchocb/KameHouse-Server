import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LazyMotion, domAnimation } from "framer-motion"
import { afterEach, describe, expect, it } from "vitest"
import { useQueueStore, type PlaylistItem } from "@/lib/stores/queue-store"
import { PlayerQueueSidebar } from "./player-queue-sidebar"

afterEach(() => { cleanup(); useQueueStore.setState({ playlistQueue: [], currentQueueIndex: -1 }) })

function Scene() {
    const queue = useQueueStore(s => s.playlistQueue)
    return <LazyMotion features={domAnimation}>
        <PlayerQueueSidebar isOpen onClose={() => {}} playlistQueue={queue} currentQueueIndex={0} />
    </LazyMotion>
}

describe("Mi Lista del reproductor: quitar filas", () => {
    it.each(["inert", "aria-hidden", "hidden", "display", "visibility"])("no enfoca una fila con %s", state => {
        useQueueStore.setState({ playlistQueue: [1, 2, 3].map(id => ({ id, mediaId: 1, title: `Episodio ${id}`, playableUrl: `/fixture-${id}` })), currentQueueIndex: 0 })
        render(<Scene />)
        const middle = screen.getByRole("button", { name: "Reproducir Episodio 2" }).closest<HTMLElement>("[data-queue-row]")
        if (!middle) throw new Error("Falta la fila intermedia de la cola")
        if (state === "display") middle.style.display = "none"
        else if (state === "visibility") middle.style.visibility = "hidden"
        else middle.setAttribute(state, state === "aria-hidden" ? "true" : "")
        fireEvent.click(screen.getByRole("button", { name: "Quitar Episodio 1 de Mi Lista" }))
        expect(screen.getByRole("button", { name: "Reproducir Episodio 3" })).toHaveFocus()
    })
    it("ignora las filas que todavía salen al quitar varias sin esperar", () => {
        const items: PlaylistItem[] = [1, 2, 3].map(id => ({ id, mediaId: 1, title: `Episodio ${id}`, playableUrl: `/fixture-${id}` }))
        useQueueStore.setState({ playlistQueue: items, currentQueueIndex: 0 })
        render(<Scene />)
        fireEvent.click(screen.getByRole("button", { name: "Quitar Episodio 3 de Mi Lista" }))
        const exiting = screen.getByRole("button", { name: "Reproducir Episodio 2" })
        fireEvent.click(screen.getByRole("button", { name: "Quitar Episodio 2 de Mi Lista" }))
        expect(exiting.closest("[inert]")).not.toBeNull()
        expect(screen.getByRole("button", { name: "Reproducir Episodio 1" })).toHaveFocus()
        fireEvent.click(screen.getByRole("button", { name: "Quitar Episodio 1 de Mi Lista" }))
        expect(screen.getByRole("button", { name: "Cerrar Mi Lista" })).toHaveFocus()
    })
    it("retira interacción de la fila saliente y enfoca la siguiente o la cabecera", async () => {
        const items: PlaylistItem[] = [1, 2].map(id => ({ id, mediaId: 1, title: `Episodio ${id}`, playableUrl: `/fixture-${id}` }))
        useQueueStore.setState({ playlistQueue: items, currentQueueIndex: 0 })
        render(<Scene />)
        const remove = screen.getByRole("button", { name: "Quitar Episodio 1 de Mi Lista" })
        remove.focus()
        fireEvent.click(remove)
        expect(remove.closest("[inert]")).not.toBeNull()
        expect(screen.getByRole("button", { name: "Reproducir Episodio 2" })).toHaveFocus()
        await waitFor(() => expect(remove).not.toBeInTheDocument())
        fireEvent.click(screen.getByRole("button", { name: "Quitar Episodio 2 de Mi Lista" }))
        expect(document.activeElement?.closest("[role=dialog]")).toBe(screen.getByRole("dialog"))
        expect(document.activeElement?.closest("[inert]")).toBeNull()
        expect(screen.getByText("Tu lista está vacía")).toBeInTheDocument()
    })
})
