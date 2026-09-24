import { describe, it, expect } from "vitest"
import {
    calculateWatchProgress,
    calculateWatchProgressPercent,
    isProgressCompleted,
    shouldPromptResume,
    calculateRemainingProgress,
} from "./continuity"

describe("continuity helpers", () => {
    describe("calculateWatchProgress", () => {
        it("calculates accurate ratio for valid numbers", () => {
            expect(calculateWatchProgress(500, 1000)).toBe(0.5)
            expect(calculateWatchProgress(850, 1000)).toBe(0.85)
            expect(calculateWatchProgress(1000, 1000)).toBe(1)
        })

        it("clamps between 0 and 1", () => {
            expect(calculateWatchProgress(-10, 1000)).toBe(0)
            expect(calculateWatchProgress(1500, 1000)).toBe(1)
        })

        it("safely handles 0 or negative duration, NaN, and Infinity", () => {
            expect(calculateWatchProgress(100, 0)).toBe(0)
            expect(calculateWatchProgress(100, -500)).toBe(0)
            expect(calculateWatchProgress(NaN, 1000)).toBe(0)
            expect(calculateWatchProgress(100, NaN)).toBe(0)
            expect(calculateWatchProgress(Infinity, 1000)).toBe(0)
            expect(calculateWatchProgress(100, Infinity)).toBe(0)
        })
    })

    describe("calculateWatchProgressPercent", () => {
        it("returns percentage from 0 to 100", () => {
            expect(calculateWatchProgressPercent(250, 1000)).toBe(25)
            expect(calculateWatchProgressPercent(850, 1000)).toBe(85)
            expect(calculateWatchProgressPercent(0, 1000)).toBe(0)
        })
    })

    describe("isProgressCompleted", () => {
        it("defaults to 0.85 threshold", () => {
            expect(isProgressCompleted(840, 1000)).toBe(false)
            expect(isProgressCompleted(850, 1000)).toBe(true)
            expect(isProgressCompleted(900, 1000)).toBe(true)
        })

        it("accepts custom threshold", () => {
            expect(isProgressCompleted(900, 1000, 0.9)).toBe(true)
            expect(isProgressCompleted(890, 1000, 0.9)).toBe(false)
        })
    })

    describe("shouldPromptResume", () => {
        it("returns true when time is greater than minResumeSeconds and not completed", () => {
            expect(shouldPromptResume(15, 1400)).toBe(true)
            expect(shouldPromptResume(600, 1400)).toBe(true)
        })

        it("returns false when time is <= minResumeSeconds", () => {
            expect(shouldPromptResume(5, 1400)).toBe(false)
            expect(shouldPromptResume(10, 1400)).toBe(false)
            expect(shouldPromptResume(0, 1400)).toBe(false)
        })

        it("returns false when previous playback is already near completion", () => {
            // 1300 / 1400 = ~92.8% >= 0.92 default threshold
            expect(shouldPromptResume(1300, 1400)).toBe(false)
        })

        it("handles null, undefined, NaN, and negative times gracefully", () => {
            expect(shouldPromptResume(null)).toBe(false)
            expect(shouldPromptResume(undefined)).toBe(false)
            expect(shouldPromptResume(NaN)).toBe(false)
            expect(shouldPromptResume(-5)).toBe(false)
        })
    })

    describe("calculateRemainingProgress", () => {
        it("calculates remaining percentage accurately", () => {
            expect(calculateRemainingProgress(5, 5)).toBe(100)
            expect(calculateRemainingProgress(2.5, 5)).toBe(50)
            expect(calculateRemainingProgress(0, 5)).toBe(0)
        })

        it("clamps between 0 and 100", () => {
            expect(calculateRemainingProgress(10, 5)).toBe(100)
            expect(calculateRemainingProgress(-2, 5)).toBe(0)
        })

        it("handles invalid countdown inputs", () => {
            expect(calculateRemainingProgress(NaN, 5)).toBe(0)
            expect(calculateRemainingProgress(5, 0)).toBe(0)
            expect(calculateRemainingProgress(5, -1)).toBe(0)
        })
    })
})
