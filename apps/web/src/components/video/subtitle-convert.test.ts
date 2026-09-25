import { describe, it, expect } from "vitest"
import { convertToAss, scaleAssStyles } from "./subtitle-convert"

const SRT = `1
00:00:06,270 --> 00:00:11,770
Obra original, historia
y creación de personajes: Akira Toriyama

2
00:01:31,600 --> 00:01:32,440
TAMAGAMI

3
00:01:32,520 --> 00:01:37,230
<i>¡Soy Tamagami Número Tres!</i>
`

describe("convertToAss", () => {
    it("emits an ASS header with a Default style and Events section", () => {
        const ass = convertToAss(SRT, "subrip")
        expect(ass).toContain("[Script Info]")
        expect(ass).toContain("[V4+ Styles]")
        expect(ass).toContain("Style: Default,")
        expect(ass).toContain("[Events]")
    })

    it("converts SRT timing (comma ms) to ASS Dialogue lines (centisecond dot)", () => {
        const ass = convertToAss(SRT, "subrip")
        // 00:00:06,270 -> 0:00:06.27 ; 00:00:11,770 -> 0:00:11.77
        expect(ass).toContain("Dialogue: 0,0:00:06.27,0:00:11.77,Default,,0,0,0,,")
    })

    it("joins wrapped lines with \\N and keeps commas in text", () => {
        const ass = convertToAss(SRT, "subrip")
        expect(ass).toContain("Obra original, historia\\Ny creación de personajes: Akira Toriyama")
    })

    it("converts <i> tags to ASS italic overrides", () => {
        const ass = convertToAss(SRT, "subrip")
        expect(ass).toContain("{\\i1}¡Soy Tamagami Número Tres!{\\i0}")
    })

    it("handles WebVTT (dot ms + cue settings) too", () => {
        const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.500 align:middle
Hello world
`
        const ass = convertToAss(vtt, "vtt")
        expect(ass).toContain("Dialogue: 0,0:00:01.00,0:00:02.50,Default,,0,0,0,,Hello world")
        expect(ass).not.toContain("WEBVTT")
        expect(ass).not.toContain("align:middle")
    })

    it("passes ASS/SSA through unchanged", () => {
        const original = "[Script Info]\nfoo\n[Events]\nDialogue: ..."
        expect(convertToAss(original, "ass")).toBe(original)
    })
})

describe("scaleAssStyles", () => {
    const ASS = [
        "[Script Info]",
        "PlayResY: 1080",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: Default,Arial,54,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2.6,1.2,2,60,60,54,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
        "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Style: no es un estilo, 54",
    ].join("\r\n")

    it("scales Fontsize, Outline and Shadow of every style", () => {
        const out = scaleAssStyles(ASS, 1.5)
        expect(out).toContain("Style: Default,Arial,81,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,3.9,1.8,2,60,60,54,1")
    })

    it("leaves events and line endings untouched", () => {
        const out = scaleAssStyles(ASS, 2)
        expect(out).toContain("Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Style: no es un estilo, 54")
        expect(out.split("\r\n")).toHaveLength(ASS.split("\r\n").length)
    })

    it("returns the content unchanged at 100%", () => {
        expect(scaleAssStyles(ASS, 1)).toBe(ASS)
    })

    it("works on the SRT/VTT conversion output", () => {
        const out = scaleAssStyles(convertToAss(SRT, "subrip"), 0.5)
        expect(out).toContain("Style: Default,Arial,27,")
    })
})
