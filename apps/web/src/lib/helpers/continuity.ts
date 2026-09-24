/**
 * Pure continuity, watch-progress, and resume calculation helpers.
 */

/**
 * Calculates normalized watch progress as a ratio between 0.0 and 1.0.
 * Safely guards against non-finite numbers, negative times, and division by zero.
 */
export function calculateWatchProgress(currentTime: number, duration: number): number {
    if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0 || currentTime <= 0) {
        return 0
    }
    const ratio = currentTime / duration
    return Math.min(1, Math.max(0, ratio))
}

/**
 * Calculates watch progress as a percentage between 0 and 100.
 */
export function calculateWatchProgressPercent(currentTime: number, duration: number): number {
    return calculateWatchProgress(currentTime, duration) * 100
}

/**
 * Checks whether the playback position has crossed the watched completion threshold
 * (e.g. 0.85 for 85%).
 */
export function isProgressCompleted(currentTime: number, duration: number, threshold = 0.85): boolean {
    return calculateWatchProgress(currentTime, duration) >= threshold
}

/**
 * Determines whether a resume prompt should be shown to the user.
 * - Requires saved time to be at least `minResumeSeconds` (default 10s) to avoid prompt on intro seconds.
 * - Rejects prompt if the previous playback was already near completion (default threshold 92%).
 */
export function shouldPromptResume(
    currentTime: number | undefined | null,
    duration?: number,
    minResumeSeconds = 10,
    completionThreshold = 0.92,
): boolean {
    if (currentTime == null || !Number.isFinite(currentTime) || currentTime <= minResumeSeconds) {
        return false
    }
    if (duration != null && Number.isFinite(duration) && duration > 0) {
        if (isProgressCompleted(currentTime, duration, completionThreshold)) {
            return false
        }
    }
    return true
}

/**
 * Calculates the percentage remaining for countdown overlays (e.g. next episode countdown).
 */
export function calculateRemainingProgress(countdownSeconds: number, countdownStart = 5): number {
    if (!Number.isFinite(countdownSeconds) || countdownStart <= 0) return 0
    const ratio = countdownSeconds / countdownStart
    return Math.max(0, Math.min(100, ratio * 100))
}
