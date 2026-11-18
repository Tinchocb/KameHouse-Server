import { logger } from "@/lib/helpers/debug"
import type { AspectRatioMode } from "./video-aspect"

interface VideoCorePgsRendererOptions {
    videoElement: HTMLVideoElement
    aspectRatio?: AspectRatioMode
    debug?: boolean
}

export interface PgsEvent {
    startTime: number // in seconds
    duration: number // in seconds
    imageData: string // base64 encoded PNG
    width: number // image width
    height: number // image height
    x?: number // position on canvas
    y?: number // position on canvas
    canvasWidth?: number // total canvas dimensions
    canvasHeight?: number
    cropX?: number
    cropY?: number
    cropWidth?: number
    cropHeight?: number
}

const log = logger("PGS RENDERER")

export class VideoCorePgsRenderer {
    _canvas: HTMLCanvasElement | null = null
    private _videoElement: HTMLVideoElement
    private _worker: Worker | null = null
    private _animationFrameId: number | null = null
    private _debug: boolean = false
    private _isDestroyed: boolean = false
    private _canvasWidth: number = 0
    private _canvasHeight: number = 0
    private _resizeObserver: ResizeObserver | null = null
    private _resizeRafId: number | null = null
    private _lastRenderedTime: number = -1
    private _lastIsPlaying: boolean = false
    private _aspectRatio: AspectRatioMode = "contain"

    constructor(options: VideoCorePgsRendererOptions) {
        this._videoElement = options.videoElement
        this._aspectRatio = options.aspectRatio ?? "contain"
        this._debug = options.debug ?? false
        this._setupCanvas()
        this._setupWorker()
        this._startRenderLoop()
    }

    setAspectRatio(aspectRatio: AspectRatioMode) {
        if (this._aspectRatio === aspectRatio) return
        this._aspectRatio = aspectRatio
        this._applyResize()
    }

    addEvents(events: PgsEvent[]) {
        if (!this._worker || events.length === 0) {
            return
        }

        this._worker.postMessage({
            type: "addEvents",
            payload: events,
        })
    }

    clear() {
        if (!this._worker) {
            return
        }

        this._worker.postMessage({
            type: "clear",
        })
    }

    destroy() {
        this._isDestroyed = true

        if (this._animationFrameId !== null) {
            cancelAnimationFrame(this._animationFrameId)
            this._animationFrameId = null
        }

        if (this._resizeRafId !== null) {
            cancelAnimationFrame(this._resizeRafId)
            this._resizeRafId = null
        }

        // Terminate worker
        if (this._worker) {
            this._worker.terminate()
            this._worker = null
        }

        // Clean up resize observer
        if (this._resizeObserver) {
            this._resizeObserver.disconnect()
            this._resizeObserver = null
        }

        if (this._canvas && this._canvas.parentElement) {
            this._canvas.parentElement.removeChild(this._canvas)
        }

        this._canvas = null
    }

    private _setupCanvas() {
        // Create canvas element
        this._canvas = document.createElement("canvas")
        this._canvas.style.position = "absolute"
        this._canvas.style.pointerEvents = "none"
        this._canvas.style.zIndex = "10"
        this._canvas.style.objectFit = "contain"
        this._canvas.style.objectPosition = "center"
        this._canvas.className = "vc-pgs-canvas"

        // Insert canvas after video element
        const parent = this._videoElement.parentElement
        if (parent) {
            if (getComputedStyle(parent).position === "static") {
                parent.style.position = "relative"
            }
            parent.appendChild(this._canvas)
        }

        // Set initial size before transferring
        const target = parent ?? this._videoElement
        const videoContentSize = this._getTargetCanvasBox(
            target.clientWidth || this._videoElement.clientWidth,
            target.clientHeight || this._videoElement.clientHeight,
        )
        if (videoContentSize) {
            const { displayedWidth, displayedHeight, offsetX, offsetY } = videoContentSize
            this._canvas.width = displayedWidth
            this._canvas.height = displayedHeight
            this._canvasWidth = displayedWidth
            this._canvasHeight = displayedHeight
            this._canvas.style.objectFit = this._aspectRatio === "contain" || this._aspectRatio === "cover" ? "contain" : "fill"
            this._canvas.style.width = `${displayedWidth}px`
            this._canvas.style.height = `${displayedHeight}px`
            this._canvas.style.left = `${offsetX}px`
            this._canvas.style.top = `${offsetY}px`
        }

        // Add resize observer to handle video/stage size changes
        this._setupResizeObserver()
    }

    private _setupWorker() {
        if (!this._canvas) {
            return
        }

        this._worker = new window.Worker("/pgs-renderer.worker.js")

        // Handle messages
        this._worker.onmessage = (e) => {
            const { type, payload } = e.data

            if (type === "debug" && this._debug) {
                log.info(payload.message, payload.data)
            } else if (type === "error") {
                log.error(payload.message, payload.error)
            }
        }

        // Transfer canvas to worker
        const offscreenCanvas = this._canvas.transferControlToOffscreen()
        this._worker.postMessage({
            type: "init",
            payload: {
                canvas: offscreenCanvas,
                debug: this._debug,
            },
        }, [offscreenCanvas])
    }

    private _applyResize() {
        if (this._isDestroyed || !this._canvas || !this._worker) return
        const target = this._videoElement.parentElement ?? this._videoElement
        const width = target.clientWidth || this._videoElement.clientWidth
        const height = target.clientHeight || this._videoElement.clientHeight
        if (!width || !height) return
        const videoContentSize = this._getTargetCanvasBox(width, height)
        if (!videoContentSize) return

        const { displayedWidth, displayedHeight, offsetX, offsetY } = videoContentSize
        this._canvasWidth = displayedWidth
        this._canvasHeight = displayedHeight
        this._canvas.style.objectFit = this._aspectRatio === "contain" || this._aspectRatio === "cover" ? "contain" : "fill"
        this._canvas.style.width = `${displayedWidth}px`
        this._canvas.style.height = `${displayedHeight}px`
        this._canvas.style.left = `${offsetX}px`
        this._canvas.style.top = `${offsetY}px`
        this._worker.postMessage({
            type: "resize",
            payload: { width: displayedWidth, height: displayedHeight },
        })
        if (this._debug) {
            log.info("Resized canvas", { width: displayedWidth, height: displayedHeight, left: offsetX, top: offsetY })
        }
    }

    private _setupResizeObserver() {
        if (!this._videoElement || !this._canvas) return

        this._resizeObserver = new ResizeObserver((entries) => {
            if (!this._canvas || !this._worker || !entries[0]) {
                return
            }
            // batch reads and writes
            if (this._resizeRafId !== null) return
            this._resizeRafId = requestAnimationFrame(() => {
                this._resizeRafId = null
                this._applyResize()
            })
        })

        const target = this._videoElement.parentElement ?? this._videoElement
        this._resizeObserver.observe(target)
    }

    private _startRenderLoop() {
        // Use requestVideoFrameCallback when available (Chrome 109+, Firefox 115+)
        // This fires only when a new video frame is presented, eliminating
        // wasted renders during pause/seek and syncing precisely with the video pipeline.
        // Falls back to requestAnimationFrame for unsupported browsers.
        const hasVideoFrameCallback = typeof this._videoElement.requestVideoFrameCallback === "function"

        const schedule = () => {
            if (this._isDestroyed) {
                return
            }

            if (hasVideoFrameCallback) {
                this._videoElement.requestVideoFrameCallback((_now, metadata) => {
                    if (this._isDestroyed) return

                    const isPlaying = !this._videoElement.paused
                    const currentTime = metadata?.mediaTime ?? this._videoElement.currentTime
                    const stateChanged = isPlaying !== this._lastIsPlaying || currentTime !== this._lastRenderedTime || this._videoElement.seeking

                    // Send render request to worker with current video state
                    if (this._worker && (isPlaying || stateChanged)) {
                        this._lastRenderedTime = currentTime
                        this._lastIsPlaying = isPlaying
                        this._worker.postMessage({
                            type: "render",
                            payload: {
                                currentTime,
                                canvasWidth: this._canvasWidth,
                                canvasHeight: this._canvasHeight,
                                isPlaying,
                            },
                        })
                    }

                    schedule()
                })
            } else {
                // Fallback: requestAnimationFrame polling (original behavior)
                const render = () => {
                    if (this._isDestroyed) {
                        return
                    }

                    const isPlaying = !this._videoElement.paused
                    const currentTime = this._videoElement.currentTime
                    const stateChanged = isPlaying !== this._lastIsPlaying || currentTime !== this._lastRenderedTime || this._videoElement.seeking

                    // Send render request to worker with current video state
                    if (this._worker && (isPlaying || stateChanged)) {
                        this._lastRenderedTime = currentTime
                        this._lastIsPlaying = isPlaying
                        this._worker.postMessage({
                            type: "render",
                            payload: {
                                currentTime,
                                canvasWidth: this._canvasWidth,
                                canvasHeight: this._canvasHeight,
                                isPlaying,
                            },
                        })
                    }

                    this._animationFrameId = requestAnimationFrame(render)
                }
                render()
            }
        }

        schedule()
    }


    private _getTargetCanvasBox(containerWidth: number, containerHeight: number) {
        if (this._aspectRatio !== "contain") {
            return { displayedWidth: containerWidth, displayedHeight: containerHeight, offsetX: 0, offsetY: 0 }
        }
        return this._getRenderedVideoContentSize(containerWidth, containerHeight)
    }

    private _getRenderedVideoContentSize(containerWidth: number, containerHeight: number) {
        const videoWidth = this._videoElement.videoWidth
        const videoHeight = this._videoElement.videoHeight

        if (!videoWidth || !videoHeight) return null

        const containerRatio = containerWidth / containerHeight
        const videoRatio = videoWidth / videoHeight

        let displayedWidth: number
        let displayedHeight: number
        let offsetX = 0
        let offsetY = 0

        if (videoRatio > containerRatio) {
            displayedWidth = containerWidth
            displayedHeight = containerWidth / videoRatio
            offsetY = (containerHeight - displayedHeight) / 2
        } else {
            displayedHeight = containerHeight
            displayedWidth = containerHeight * videoRatio
            offsetX = (containerWidth - displayedWidth) / 2
        }

        return { displayedWidth, displayedHeight, offsetX, offsetY }
    }
}
