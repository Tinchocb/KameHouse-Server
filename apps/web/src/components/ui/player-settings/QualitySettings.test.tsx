import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { QualitySettings } from "./QualitySettings"
import type { EpisodeSource } from "@/api/types/unified.types"

const sources = [
    { type: "local", url: "a.mkv", quality: "1080p", priority: 1, title: "Disco A" },
    { type: "local", url: "b.mkv", quality: "720p", priority: 2, title: "Disco B" },
] as unknown as EpisodeSource[]

function activeTitles() {
    return screen.getAllByRole("button")
        .filter(b => b.querySelector("svg"))
        .map(b => b.textContent)
}

describe("QualitySettings", () => {
    it("marca solo la fuente cuya URL se está reproduciendo", () => {
        render(<QualitySettings sources={sources} currentSourceUrl="b.mkv" currentSourceType="local" onSourceChange={vi.fn()} />)
        const active = activeTitles()
        expect(active).toHaveLength(1)
        expect(active[0]).toContain("Disco B")
    })

    it("sin coincidencia de URL cae al tipo, pero marca una sola", () => {
        render(<QualitySettings sources={sources} currentSourceUrl="/stream/xyz" currentSourceType="local" onSourceChange={vi.fn()} />)
        expect(activeTitles()).toHaveLength(1)
    })
})
