import { describe, expect, it } from "vitest"
import { findIgnoredBinaryPaths } from "./settings"

describe("findIgnoredBinaryPaths", () => {
    it("avisa cuando el servidor reemplazó la ruta escrita", () => {
        expect(findIgnoredBinaryPaths(
            { ffmpegPath: "D:/tools/ffmpeg.exe", ffprobePath: "" },
            { ffmpegPath: "C:/ProgramData/chocolatey/bin/ffmpeg.exe", ffprobePath: "/usr/bin/ffprobe" },
        )).toEqual([{ label: "FFmpeg", wanted: "D:/tools/ffmpeg.exe", used: "C:/ProgramData/chocolatey/bin/ffmpeg.exe" }])
    })

    it("no avisa si la ruta quedó o si el campo estaba vacío", () => {
        expect(findIgnoredBinaryPaths({ ffmpegPath: "C:/a/ffmpeg.exe " }, { ffmpegPath: "C:/a/ffmpeg.exe" })).toEqual([])
        expect(findIgnoredBinaryPaths({ ffmpegPath: "" }, { ffmpegPath: "C:/a/ffmpeg.exe" })).toEqual([])
        expect(findIgnoredBinaryPaths(undefined, undefined)).toEqual([])
    })
})
