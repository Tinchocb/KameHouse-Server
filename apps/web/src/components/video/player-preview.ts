import { getServerBaseUrl } from "@/api/client/server-url"
import { authorizeResourceUrl } from "@/api/client/auth"

export interface PreviewFrame {
    url: string
    column: number
    row: number
    columns: number
    rows: number
}
interface Manifest { version: string; interval: number; columns: number; rows: number; width: number; height: number }

/** Persistent server images; never opens another video or seeks the playback stream. */
export class PlayerPreviewManager {
    private manifest: Manifest | null = null
    private pending: { sheet: number; controller: AbortController; promise: Promise<string> } | null = null
    private manifestPromise: Promise<Manifest> | null = null
    private lifetime = new AbortController()
    private cache = new Map<number, string>()
    private disposed = false
    private requested = false

    constructor(private readonly path: string, private readonly duration: () => number = () => 0) {}

    prewarm(): void {
        if (this.requested || this.disposed) return
        // Warm only the small index. Cold frame extraction competes with the
        // first playback buffer, especially over Drive; wait for actual hover.
        void this.loadManifest().catch(() => {})
    }

    private endpoint(): URL {
        const url = new URL("/api/v1/video-storyboard", getServerBaseUrl() || window.location.origin)
        url.searchParams.set("path", this.path)
        return new URL(authorizeResourceUrl(url.toString()))
    }

    calculateSegmentIndex(time: number): number {
        const duration = this.duration()
        const end = Number.isFinite(duration) && duration > 0 ? Math.max(0, duration - 0.001) : Infinity
        return Math.floor(Math.min(end, Math.max(0, Number.isFinite(time) ? time : 0)) / (this.manifest?.interval ?? 10))
    }

    private loadManifest(): Promise<Manifest> {
        if (!this.manifestPromise) {
            this.manifestPromise = fetch(this.endpoint(), { signal: this.lifetime.signal })
                .then(async response => {
                    if (!response.ok) throw new Error("Vista previa no disponible")
                    const value = await response.json() as Manifest
                    if (!/^[a-f0-9]{64}$/.test(value.version) || value.interval !== 10 || value.columns !== 4 || value.rows !== 3 || value.width !== 200 || value.height !== 112) {
                        throw new Error("Índice de miniaturas inválido")
                    }
                    this.manifest = value
                    return value
                }).catch(error => { this.manifestPromise = null; throw error })
        }
        return this.manifestPromise
    }

    private async loadSheet(segment: number, manifest: Manifest, signal: AbortSignal): Promise<string> {
        const url = this.endpoint()
        url.searchParams.set("sheet", String(Math.floor(segment / (manifest.columns * manifest.rows))))
        url.searchParams.set("frame", String(segment % (manifest.columns * manifest.rows)))
        url.searchParams.set("v", manifest.version)
        // A busy encoder yields to playback. Retry only the latest requested sheet.
        for (let attempt = 0; attempt < 4; attempt++) {
            const response = await fetch(url, { signal })
            if (response.status === 409) {
                this.manifest = null
                this.manifestPromise = null
                for (const cached of this.cache.values()) URL.revokeObjectURL(cached)
                this.cache.clear()
            }
            if (response.status === 503 && attempt < 3) {
                await new Promise<void>((resolve, reject) => {
                    const abort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")) }
                    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve() }, 750)
                    signal.addEventListener("abort", abort, { once: true })
                    if (signal.aborted) abort()
                })
                continue
            }
            if (!response.ok) throw new Error("Vista previa no disponible")
            const blob = await response.blob()
            if (signal.aborted || this.disposed) throw new DOMException("Aborted", "AbortError")
            if (!blob.type.startsWith("image/") || blob.size > 4 * 1024 * 1024) throw new Error("Miniatura inválida")
            const objectUrl = URL.createObjectURL(blob)
            this.cache.set(segment, objectUrl)
            // Only a small working set stays in memory; browser/disk cache persists.
            if (this.cache.size > 48) {
                const oldest = this.cache.keys().next().value
                if (oldest !== undefined) {
                    const cachedUrl = this.cache.get(oldest)
                    if (cachedUrl) URL.revokeObjectURL(cachedUrl)
                    this.cache.delete(oldest)
                }
            }
            return objectUrl
        }
        throw new Error("Vista previa no disponible")
    }

    async retrievePreviewForSegment(segment: number): Promise<PreviewFrame> {
        this.requested = true
        const manifest = await this.loadManifest()
        if (this.disposed) throw new DOMException("Aborted", "AbortError")
        const sheet = segment // Each demand now requests one frame, not a complete sheet.
        if (this.pending && this.pending.sheet !== sheet) this.pending.controller.abort()
        let url = this.cache.get(sheet)
        if (!url) {
            if (this.pending?.sheet !== sheet || this.pending.controller.signal.aborted) {
                this.pending?.controller.abort()
                const controller = new AbortController()
                const pending = { sheet, controller, promise: this.loadSheet(sheet, manifest, controller.signal) }
                this.pending = pending
                void pending.promise.finally(() => { if (this.pending === pending) this.pending = null }).catch(() => {})
            }
            if (this.pending) {
                url = await this.pending.promise
            }
        }
        return { url: url ?? "", column: 0, row: 0, columns: 1, rows: 1 }
    }

    cleanup(): void {
        this.disposed = true
        this.lifetime.abort()
        this.pending?.controller.abort()
        for (const url of this.cache.values()) URL.revokeObjectURL(url)
        this.cache.clear()
    }
}
