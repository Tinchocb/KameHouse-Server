import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PresenceContext } from "framer-motion"
import { LoadingErrorOverlay, SkipIntroOverlay, CenterPlayFlash, AutoSkipToastOverlay, NextEpisodeOverlay, NextEpisodeLayer, STREAM_FILE_MISSING_MSG, STREAM_DRIVE_AUTH_MSG } from "./player-overlays"

describe("Player Overlays", () => {
    describe("LoadingErrorOverlay", () => {
        it("renders loading state", () => {
            const { container } = render(<LoadingErrorOverlay status="loading" errorMsg="" streamType="transcode" isBuffering={false} onClose={() => {}} />)
            expect(container.querySelector("svg.lucide-loader-circle")).toBeInTheDocument()
        })

        it("renders error state with generic message", () => {
            render(<LoadingErrorOverlay status="error" errorMsg="Stream no encontrado" streamType="transcode" isBuffering={false} onClose={() => {}} />)
            expect(screen.getByText(/No se pudo reproducir/i)).toBeInTheDocument()
            expect(screen.getByText("Stream no encontrado")).toBeInTheDocument()
        })

        it("titula distinto cuando falta el archivo", () => {
            render(<LoadingErrorOverlay status="error" errorMsg={STREAM_FILE_MISSING_MSG} streamType="direct" isBuffering={false} onClose={() => {}} />)
            expect(screen.getByText(/ARCHIVO NO DISPONIBLE/i)).toBeInTheDocument()
            expect(screen.queryByText(/No se pudo reproducir/i)).not.toBeInTheDocument()
        })

        it("ofrece ir a Ajustes cuando Drive se desconectó", () => {
            render(<LoadingErrorOverlay status="error" errorMsg={STREAM_DRIVE_AUTH_MSG} streamType="direct" isBuffering={false} onClose={() => {}} />)
            expect(screen.getByText(/DRIVE DESCONECTADO/i)).toBeInTheDocument()
            expect(screen.getByText(/IR A AJUSTES/i)).toBeInTheDocument()
        })

        it("calls onClose when returning from error", () => {
            const spy = vi.fn()
            render(<LoadingErrorOverlay status="error" errorMsg="x" streamType="x" isBuffering={false} onClose={spy} />)
            fireEvent.click(screen.getByText(/VOLVER/i))
            expect(spy).toHaveBeenCalledTimes(1)
        })
    })

    describe("CenterPlayFlash", () => {
        it("returns nothing if null", () => {
            const { container } = render(<CenterPlayFlash flash={null} />)
            expect(container.firstChild).toBeNull()
        })
        it("renders flash element if play", () => {
            const { container } = render(<CenterPlayFlash flash="play" />)
            expect(container.firstChild).not.toBeNull()
        })
    })

    describe("SkipIntroOverlay", () => {
        it("muestra Saltar resumen como nombre accesible y permite activarlo", () => {
            const onSkip = vi.fn()
            render(<SkipIntroOverlay show skipMode="recap" onSkip={onSkip} />)
            fireEvent.click(screen.getByRole("button", { name: "Saltar resumen" }))
            expect(onSkip).toHaveBeenCalledOnce()
        })
        it("hides when show is false", () => {
            const spy = vi.fn()
            render(<SkipIntroOverlay show={false} onSkip={spy} />)
            const btn = screen.getByRole("button", { name: /saltar intro/i, hidden: true })
            // the parent div will have opacity-0 if not show
            expect(btn.parentElement).toHaveClass("opacity-0")
        })

        it("shows when show is true and triggers callback", () => {
            const spy = vi.fn()
            render(<SkipIntroOverlay show={true} onSkip={spy} />)
            const btn = screen.getByRole("button", { name: /saltar intro/i })
            expect(btn.parentElement).toHaveClass("opacity-100")
            fireEvent.click(btn)
            expect(spy).toHaveBeenCalledTimes(1)
        })
    })

    describe("SkipIntroOverlay apilado sobre la tarjeta", () => {
        it("con la tarjeta de siguiente episodio visible, el botón de créditos queda encima de ella", () => {
            const spy = vi.fn()
            render(<SkipIntroOverlay show skipMode="outro" stackAbove onSkip={spy} />)
            const btn = screen.getByRole("button", { name: /saltar créditos/i })
            expect(btn.parentElement).toHaveClass("-translate-y-[10.25rem]")
        })
    })

    describe("Cambio de stream", () => {
        it("dice cambio de fuente cuando se eligió otra fuente", () => {
            render(<LoadingErrorOverlay status="loading" errorMsg="" streamType="transcode" isBuffering={false} isStreamSwitching streamSwitchReason="source" onClose={() => {}} />)
            expect(screen.getByText("Cambiando de fuente")).toBeInTheDocument()
            expect(screen.queryByText("Cambiando pista de audio")).not.toBeInTheDocument()
        })

        it("no habla de pista de audio en el fallback de direct play", () => {
            render(<LoadingErrorOverlay status="loading" errorMsg="" streamType="transcode" isBuffering={false} isStreamSwitching streamSwitchReason="fallback" onClose={() => {}} />)
            expect(screen.getByText("Preparando el video")).toBeInTheDocument()
        })
    })

    describe("AutoSkipToastOverlay", () => {
        it("un segmento saltado no dice 'Reproducción pausada'", () => {
            render(<AutoSkipToastOverlay showType="segment" onUndo={() => {}} />)
            expect(screen.getByText("Segmento saltado")).toBeInTheDocument()
            expect(screen.getByRole("button", { name: "Deshacer salto" })).toBeInTheDocument()
        })
    })

    describe("NextEpisodeOverlay", () => {
        const base = {
            tvMode: false,
            duration: 0,
            showCountdown: false,
            countdownSeconds: 0,
            remainingProgress: 0,
            onNext: () => {},
        }

        it("la pastilla visible recibe clics", () => {
            render(<NextEpisodeOverlay {...base} show nextEpisodeTitle="Episodio 2" />)
            const boton = screen.getByRole("button", { name: /ver siguiente episodio/i })
            expect(boton.parentElement).toHaveClass("pointer-events-auto")
        })
    })

    describe("NextEpisodeLayer", () => {
        it("sin presencia (la pastilla está saliendo) no recibe clics", () => {
            render(
                <PresenceContext.Provider value={{ id: "next-episode-overlay", isPresent: false, register: () => () => {} }}>
                    <NextEpisodeLayer>
                        <button>Ver siguiente episodio</button>
                    </NextEpisodeLayer>
                </PresenceContext.Provider>
            )
            const capa = screen.getByRole("button").parentElement as HTMLElement
            expect(capa).toHaveClass("pointer-events-none")
            expect(capa).not.toHaveClass("pointer-events-auto")
        })

        it("con presencia activa recibe clics", () => {
            render(
                <PresenceContext.Provider value={{ id: "next-episode-overlay", isPresent: true, register: () => () => {} }}>
                    <NextEpisodeLayer>
                        <button>Ver siguiente episodio</button>
                    </NextEpisodeLayer>
                </PresenceContext.Provider>
            )
            const capa = screen.getByRole("button").parentElement as HTMLElement
            expect(capa).toHaveClass("pointer-events-auto")
        })
    })
})
