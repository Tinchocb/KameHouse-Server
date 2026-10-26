import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LazyMotion, domAnimation } from "framer-motion"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SeriesAudioProfilePicker } from "./series-audio-profile-picker"

const { setProfile, setTrackIndex, profilesState } = vi.hoisted(() => ({
    setProfile: vi.fn(),
    setTrackIndex: vi.fn(),
    profilesState: { data: [] as Array<{ mediaId: number; audioProfile: string }> },
}))

vi.mock("@/api/hooks/media_audio.hooks", () => ({
    useMediaAudioProfiles: () => ({ data: profilesState.data }),
    useSetMediaAudioProfile: () => ({ mutate: setProfile, isPending: false }),
}))

vi.mock("@/lib/store", () => ({
    usePlayerStore: (selector: (state: unknown) => unknown) =>
        selector({ preferredAudioProfile: "latino", setPreferredAudioTrackIndex: setTrackIndex }),
}))

function renderPicker(mediaId: number | undefined) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <LazyMotion features={domAnimation}>
                <SeriesAudioProfilePicker mediaId={mediaId} />
            </LazyMotion>
        </QueryClientProvider>,
    )
}

describe("SeriesAudioProfilePicker", () => {
    beforeEach(() => {
        setProfile.mockReset()
        setTrackIndex.mockReset()
        profilesState.data = []
    })

    it("marca Global cuando la serie no tiene perfil propio", () => {
        renderPicker(12)
        expect(screen.getByRole("radio", { name: "Global (Latino)" }).getAttribute("aria-checked")).toBe("true")
        expect(screen.getByRole("radio", { name: "Japonés" }).getAttribute("aria-checked")).toBe("false")
    })

    it("marca el perfil guardado de la serie", () => {
        profilesState.data = [{ mediaId: 236, audioProfile: "japanese" }]
        renderPicker(236)
        expect(screen.getByRole("radio", { name: "Japonés" }).getAttribute("aria-checked")).toBe("true")
        expect(screen.getByRole("radio", { name: "Global (Latino)" }).getAttribute("aria-checked")).toBe("false")
    })

    it("guarda el perfil elegido y borra la pista elegida a mano en esa serie", () => {
        renderPicker(236)
        fireEvent.click(screen.getByRole("radio", { name: "Japonés" }))
        expect(setTrackIndex).toHaveBeenCalledWith(236, -1)
        expect(setProfile).toHaveBeenCalledWith({ mediaId: 236, audioProfile: "japanese" })
    })

    it("volver a Global guarda un perfil vacío", () => {
        profilesState.data = [{ mediaId: 236, audioProfile: "japanese" }]
        renderPicker(236)
        fireEvent.click(screen.getByRole("radio", { name: "Global (Latino)" }))
        expect(setProfile).toHaveBeenCalledWith({ mediaId: 236, audioProfile: "" })
    })

    it("tocar la opción que ya está marcada no envía nada", () => {
        renderPicker(12)
        fireEvent.click(screen.getByRole("radio", { name: "Global (Latino)" }))
        expect(setProfile).not.toHaveBeenCalled()
        expect(setTrackIndex).not.toHaveBeenCalled()
    })

    it("muestra las siglas visualmente en los botones", () => {
        renderPicker(12)
        expect(screen.getByText("GLO (LAT)")).toBeInTheDocument()
        expect(screen.getByText("LAT")).toBeInTheDocument()
        expect(screen.getByText("CAS")).toBeInTheDocument()
        expect(screen.getByText("JAP")).toBeInTheDocument()
        expect(screen.getByText("ENG")).toBeInTheDocument()
        expect(screen.getByText("AUTO")).toBeInTheDocument()
    })

    it("no se muestra sin serie", () => {
        const { container } = renderPicker(undefined)
        expect(container.querySelector("section")).toBeNull()
    })
})
