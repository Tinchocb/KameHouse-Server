export type AspectRatioMode = "contain" | "fill" | "cover" | "16/9" | "21/9"

export interface NormalizedBounds {
    left: number
    top: number
    right: number
    bottom: number
}

export const FULL_FRAME_BOUNDS: NormalizedBounds = {
    left: 0,
    top: 0,
    right: 1,
    bottom: 1,
}

export interface VideoAspectLayout {
    stageWidth: number
    stageHeight: number
    videoWidth: number
    videoHeight: number
    videoLeft: number
    videoTop: number
    objectFit: "contain" | "cover" | "fill"
}

export interface ComputeVideoAspectLayoutParams {
    containerWidth: number
    containerHeight: number
    intrinsicWidth: number
    intrinsicHeight: number
    aspectRatio: AspectRatioMode
    contentBounds?: NormalizedBounds
}

const MIN_BAR_INSET = 0.04
const MAX_BAR_INSET = 0.30
const MAX_BAR_ASYMMETRY = 0.045
const MIN_ACTIVE_SPAN = 0.40
const BAR_EDGE_TRIM = 0.004

const BAR_ROW_COL_MEAN_MAX = 18
const BAR_PIXEL_LUMA_MAX = 26
const BAR_NONBLACK_RATIO_MAX = 0.05

const CENTER_MIN_MAX_LUMA = 40
const CENTER_BRIGHT_LUMA = 32
const CENTER_MIN_BRIGHT_RATIO = 0.03

function clamp(val: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, val))
}

function fitAspectBox(maxWidth: number, maxHeight: number, targetRatio: number): { width: number; height: number } {
    if (maxWidth <= 0 || maxHeight <= 0 || targetRatio <= 0) {
        return { width: 0, height: 0 }
    }
    const containerRatio = maxWidth / maxHeight
    if (containerRatio > targetRatio) {
        return { width: maxHeight * targetRatio, height: maxHeight }
    }
    return { width: maxWidth, height: maxWidth / targetRatio }
}

function sanitizeBounds(bounds?: NormalizedBounds): NormalizedBounds {
    if (!bounds) return FULL_FRAME_BOUNDS
    const left = clamp(bounds.left, 0, 0.35)
    const top = clamp(bounds.top, 0, 0.35)
    const right = clamp(bounds.right, 0.65, 1)
    const bottom = clamp(bounds.bottom, 0.65, 1)
    if (right - left < 0.25 || bottom - top < 0.25) {
        return FULL_FRAME_BOUNDS
    }
    return { left, top, right, bottom }
}

/**
 * Computes the clipped stage dimensions and the `<video>` element geometry
 * inside it for all 5 aspect ratio modes, including baked-in letterbox/pillarbox
 * compensation when `contentBounds` is narrower/shorter than `[0, 1]`.
 */
export function computeVideoAspectLayout({
    containerWidth,
    containerHeight,
    intrinsicWidth,
    intrinsicHeight,
    aspectRatio,
    contentBounds,
}: ComputeVideoAspectLayoutParams): VideoAspectLayout {
    if (containerWidth <= 0 || containerHeight <= 0) {
        return {
            stageWidth: 0,
            stageHeight: 0,
            videoWidth: 0,
            videoHeight: 0,
            videoLeft: 0,
            videoTop: 0,
            objectFit: aspectRatio === "contain" ? "contain" : "fill",
        }
    }

    if (aspectRatio === "contain") {
        return {
            stageWidth: containerWidth,
            stageHeight: containerHeight,
            videoWidth: containerWidth,
            videoHeight: containerHeight,
            videoLeft: 0,
            videoTop: 0,
            objectFit: "contain",
        }
    }

    const stage =
        aspectRatio === "16/9"
            ? fitAspectBox(containerWidth, containerHeight, 16 / 9)
            : aspectRatio === "21/9"
                ? fitAspectBox(containerWidth, containerHeight, 21 / 9)
                : { width: containerWidth, height: containerHeight }

    const bounds = sanitizeBounds(contentBounds)
    const aw = bounds.right - bounds.left
    const ah = bounds.bottom - bounds.top
    const cx = (bounds.left + bounds.right) / 2
    const cy = (bounds.top + bounds.bottom) / 2

    if (intrinsicWidth <= 0 || intrinsicHeight <= 0) {
        return {
            stageWidth: stage.width,
            stageHeight: stage.height,
            videoWidth: stage.width / aw,
            videoHeight: stage.height / ah,
            videoLeft: stage.width / 2 - (stage.width / aw) * cx,
            videoTop: stage.height / 2 - (stage.height / ah) * cy,
            objectFit: aspectRatio === "cover" ? "cover" : "fill",
        }
    }

    const rv = intrinsicWidth / intrinsicHeight

    if (aspectRatio === "cover") {
        const contentRatio = rv * (aw / ah)
        const stageRatio = stage.width / stage.height
        let videoWidth: number
        let videoHeight: number
        if (contentRatio > stageRatio) {
            videoHeight = stage.height / ah
            videoWidth = videoHeight * rv
        } else {
            videoWidth = stage.width / aw
            videoHeight = videoWidth / rv
        }
        return {
            stageWidth: stage.width,
            stageHeight: stage.height,
            videoWidth,
            videoHeight,
            videoLeft: stage.width / 2 - videoWidth * cx,
            videoTop: stage.height / 2 - videoHeight * cy,
            objectFit: "fill",
        }
    }

    // "fill", "16/9", "21/9": stretch active content to fill the target stage without cropping.
    const videoWidth = stage.width / aw
    const videoHeight = stage.height / ah
    return {
        stageWidth: stage.width,
        stageHeight: stage.height,
        videoWidth,
        videoHeight,
        videoLeft: stage.width / 2 - videoWidth * cx,
        videoTop: stage.height / 2 - videoHeight * cy,
        objectFit: "fill",
    }
}

/**
 * Analyzes an RGBA video frame buffer to detect symmetrical baked-in black bars
 * (e.g. 4:3 pillarboxes or 21:9 letterboxes encoded inside a 16:9 frame).
 * Returns `null` when the frame is too dark to decide reliably.
 */
export function detectBlackBarsFromPixels(
    data: Uint8ClampedArray,
    width: number,
    height: number,
): NormalizedBounds | null {
    if (width < 32 || height < 18 || data.length < width * height * 4) {
        return null
    }

    const lumaAt = (x: number, y: number): number => {
        const idx = (y * width + x) * 4
        return (54 * data[idx] + 183 * data[idx + 1] + 19 * data[idx + 2]) >> 8
    }

    // Reject completely dark frames / fades so dark transitions never trigger false crops.
    const cx0 = Math.floor(width * 0.2)
    const cx1 = Math.ceil(width * 0.8)
    const cy0 = Math.floor(height * 0.2)
    const cy1 = Math.ceil(height * 0.8)
    let centerMax = 0
    let centerBright = 0
    let centerCount = 0

    for (let y = cy0; y < cy1; y++) {
        for (let x = cx0; x < cx1; x++) {
            const l = lumaAt(x, y)
            if (l > centerMax) centerMax = l
            if (l >= CENTER_BRIGHT_LUMA) centerBright++
            centerCount++
        }
    }

    if (centerCount === 0 || centerMax < CENTER_MIN_MAX_LUMA || centerBright / centerCount < CENTER_MIN_BRIGHT_RATIO) {
        return null
    }

    // Horizontal scan (pillarboxes)
    const py0 = Math.floor(height * 0.12)
    const py1 = Math.ceil(height * 0.88)
    const pRowCount = Math.max(1, py1 - py0)
    const isBlackColumn = (x: number): boolean => {
        let sum = 0
        let nonBlack = 0
        for (let y = py0; y < py1; y++) {
            const l = lumaAt(x, y)
            sum += l
            if (l > BAR_PIXEL_LUMA_MAX) nonBlack++
        }
        return sum / pRowCount <= BAR_ROW_COL_MEAN_MAX && nonBlack / pRowCount <= BAR_NONBLACK_RATIO_MAX
    }

    let leftCol = 0
    while (leftCol < width && isBlackColumn(leftCol)) leftCol++
    let rightCol = width - 1
    while (rightCol > leftCol && isBlackColumn(rightCol)) rightCol--

    const leftInset = leftCol / width
    const rightInset = (width - 1 - rightCol) / width
    const hasPillarbox =
        leftInset >= MIN_BAR_INSET &&
        rightInset >= MIN_BAR_INSET &&
        leftInset <= MAX_BAR_INSET &&
        rightInset <= MAX_BAR_INSET &&
        Math.abs(leftInset - rightInset) <= MAX_BAR_ASYMMETRY &&
        1 - leftInset - rightInset >= MIN_ACTIVE_SPAN

    const left = hasPillarbox ? clamp(leftInset + BAR_EDGE_TRIM, 0, 0.32) : 0
    const right = hasPillarbox ? clamp(1 - rightInset - BAR_EDGE_TRIM, 0.68, 1) : 1

    // Vertical scan (letterboxes)
    const lx0 = Math.floor(width * 0.12)
    const lx1 = Math.ceil(width * 0.88)
    const lColCount = Math.max(1, lx1 - lx0)
    const isBlackRow = (y: number): boolean => {
        let sum = 0
        let nonBlack = 0
        for (let x = lx0; x < lx1; x++) {
            const l = lumaAt(x, y)
            sum += l
            if (l > BAR_PIXEL_LUMA_MAX) nonBlack++
        }
        return sum / lColCount <= BAR_ROW_COL_MEAN_MAX && nonBlack / lColCount <= BAR_NONBLACK_RATIO_MAX
    }

    let topRow = 0
    while (topRow < height && isBlackRow(topRow)) topRow++
    let bottomRow = height - 1
    while (bottomRow > topRow && isBlackRow(bottomRow)) bottomRow--

    const topInset = topRow / height
    const bottomInset = (height - 1 - bottomRow) / height
    const hasLetterbox =
        topInset >= MIN_BAR_INSET &&
        bottomInset >= MIN_BAR_INSET &&
        topInset <= MAX_BAR_INSET &&
        bottomInset <= MAX_BAR_INSET &&
        Math.abs(topInset - bottomInset) <= MAX_BAR_ASYMMETRY &&
        1 - topInset - bottomInset >= MIN_ACTIVE_SPAN

    const top = hasLetterbox ? clamp(topInset + BAR_EDGE_TRIM, 0, 0.32) : 0
    const bottom = hasLetterbox ? clamp(1 - bottomInset - BAR_EDGE_TRIM, 0.68, 1) : 1

    return { left, top, right, bottom }
}

export function boundsSignificantlyEqual(a: NormalizedBounds, b: NormalizedBounds, epsilon = 0.012): boolean {
    return (
        Math.abs(a.left - b.left) <= epsilon &&
        Math.abs(a.top - b.top) <= epsilon &&
        Math.abs(a.right - b.right) <= epsilon &&
        Math.abs(a.bottom - b.bottom) <= epsilon
    )
}

/**
 * Maintains a sliding window of recent bright-frame bar detections and yields
 * their outermost union so momentary dark edges in a scene do not over-crop.
 */
export class BlackBarConsensusTracker {
    private samples: NormalizedBounds[] = []
    private readonly maxSamples: number

    constructor(maxSamples = 5) {
        this.maxSamples = maxSamples
    }

    reset(): void {
        this.samples = []
    }

    push(sample: NormalizedBounds | null): NormalizedBounds {
        if (sample) {
            this.samples.push(sample)
            if (this.samples.length > this.maxSamples) {
                this.samples.shift()
            }
        }
        return this.getBounds()
    }

    getBounds(): NormalizedBounds {
        if (this.samples.length === 0) return FULL_FRAME_BOUNDS
        let left = 1
        let top = 1
        let right = 0
        let bottom = 0
        for (const s of this.samples) {
            if (s.left < left) left = s.left
            if (s.top < top) top = s.top
            if (s.right > right) right = s.right
            if (s.bottom > bottom) bottom = s.bottom
        }
        if (right - left < 0.25 || bottom - top < 0.25) {
            return FULL_FRAME_BOUNDS
        }
        return { left, top, right, bottom }
    }
}
