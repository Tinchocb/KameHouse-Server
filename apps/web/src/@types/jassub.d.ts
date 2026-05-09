declare module "jassub" {
    interface JassubOptions {
        video: HTMLVideoElement
        subContent?: string
        subUrl?: string
        workerUrl: string
        wasmUrl: string
        modernWasmUrl?: string
        canvas?: HTMLCanvasElement
        useOffscreen?: boolean
        prescaleFactor?: number
        width?: number
        height?: number
        /** Enable lossy render for better performance */
        lossyRender?: boolean
        /** Time offset in seconds */
        timeOffset?: number
    }

    class JASSUB {
        constructor(options: JassubOptions)
        destroy(): void
        setCurrentTime(time: number): void
        setVolume(volume: number): void
        setIsPaused(isPaused: boolean): void
        resize(): void
    }

    export default JASSUB
}
