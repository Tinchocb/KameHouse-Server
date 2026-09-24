import { describe, it, expect } from "vitest"
import { upath } from "./upath"

describe("upath helper", () => {
    describe("toUnix", () => {
        it("converts Windows backslashes to Unix forward slashes", () => {
            expect(upath.toUnix("C:\\Users\\KameHouse\\video.mkv")).toBe("C:/Users/KameHouse/video.mkv")
            expect(upath.toUnix("path\\to\\nested\\file.txt")).toBe("path/to/nested/file.txt")
        })

        it("collapses consecutive slashes but preserves leading UNC slashes", () => {
            expect(upath.toUnix("a//b///c")).toBe("a/b/c")
            expect(upath.toUnix("//server/share/file")).toBe("//server/share/file")
        })

        it("handles non-string inputs safely", () => {
            expect(upath.toUnix(null as unknown as string)).toBe(null)
            expect(upath.toUnix(undefined as unknown as string)).toBe(undefined)
        })
    })

    describe("join & normalize", () => {
        it("joins path segments into normalized unix paths", () => {
            expect(upath.join("media", "dragon_ball", "ep1.mkv")).toBe("media/dragon_ball/ep1.mkv")
            expect(upath.join("media/", "/dragon_ball/", "ep1.mkv")).toBe("media/dragon_ball/ep1.mkv")
            expect(upath.join("a", "..", "b")).toBe("b")
            expect(upath.join("")).toBe(".")
        })

        it("normalizes dot and double-dot segments", () => {
            expect(upath.normalize("/a/b/../c/./d")).toBe("/a/c/d")
            expect(upath.normalize("/a//b/")).toBe("/a/b/")
            expect(upath.normalize("//server//share/")).toBe("//server/share/")
            expect(upath.normalize("")).toBe(".")
        })
    })

    describe("isAbsolute, dirname, basename, extname", () => {
        it("detects absolute paths on unix and windows drive letters", () => {
            expect(upath.isAbsolute("/root/media")).toBe(true)
            expect(upath.isAbsolute("D:/Proyectos/media")).toBe(true)
            expect(upath.isAbsolute("C:\\Videos\\ep.mkv")).toBe(true)
            expect(upath.isAbsolute("relative/path")).toBe(false)
        })

        it("extracts directory name accurately", () => {
            expect(upath.dirname("/media/dragon_ball/ep1.mkv")).toBe("/media/dragon_ball")
            expect(upath.dirname("ep1.mkv")).toBe(".")
            expect(upath.dirname("/")).toBe("/")
        })

        it("extracts basename with or without extension trimming", () => {
            expect(upath.basename("/media/dragon_ball/ep1.mkv")).toBe("ep1.mkv")
            expect(upath.basename("/media/dragon_ball/ep1.mkv", ".mkv")).toBe("ep1")
            expect(upath.basename("")).toBe("")
        })

        it("extracts extension accurately", () => {
            expect(upath.extname("video.mkv")).toBe(".mkv")
            expect(upath.extname("archive.tar.gz")).toBe(".gz")
            expect(upath.extname(".bashrc")).toBe("")
            expect(upath.extname("no_ext")).toBe("")
        })
    })

    describe("parse, format, relative", () => {
        it("parses paths into component objects", () => {
            const parsed = upath.parse("/media/dbz/ep01.mp4")
            expect(parsed.root).toBe("/")
            expect(parsed.dir).toBe("/media/dbz")
            expect(parsed.base).toBe("ep01.mp4")
            expect(parsed.name).toBe("ep01")
            expect(parsed.ext).toBe(".mp4")
        })

        it("formats path objects back to strings", () => {
            expect(upath.format({ dir: "/media/dbz", base: "ep01.mp4" })).toBe("/media/dbz/ep01.mp4")
            expect(upath.format({ root: "/", name: "video", ext: ".mkv" })).toBe("/video.mkv")
            expect(upath.format({})).toBe(".")
        })

        it("calculates relative path between from and to", () => {
            expect(upath.relative("/media/dbz/ep01", "/media/dbz/ep02")).toBe("../ep02")
            expect(upath.relative("/media/series", "/media/series/db/ep1")).toBe("db/ep1")
            expect(upath.relative("/same/path", "/same/path")).toBe("")
        })
    })

    describe("extension utilities: addExt, trimExt, removeExt, changeExt, defaultExt", () => {
        it("adds extensions when missing", () => {
            expect(upath.addExt("video", "mkv")).toBe("video.mkv")
            expect(upath.addExt("video", ".mkv")).toBe("video.mkv")
            expect(upath.addExt("video.mkv", ".mkv")).toBe("video.mkv")
            expect(upath.addExt("video", "")).toBe("video")
        })

        it("trims and removes extensions", () => {
            expect(upath.trimExt("video.mkv")).toBe("video")
            expect(upath.removeExt("video.mkv", ".mkv")).toBe("video")
            expect(upath.removeExt("video.mkv", ".mp4")).toBe("video.mkv")
        })

        it("changes extension", () => {
            expect(upath.changeExt("video.mkv", ".mp4")).toBe("video.mp4")
            expect(upath.changeExt("video.mkv", "")).toBe("video")
        })

        it("applies default extension if current extension is missing or invalid", () => {
            expect(upath.defaultExt("video", ".mkv")).toBe("video.mkv")
            expect(upath.defaultExt("video.mkv", ".mp4")).toBe("video.mkv")
        })
    })

    describe("normalizeSafe & normalizeTrim & joinSafe", () => {
        it("preserves leading ./ when present in original path", () => {
            expect(upath.normalizeSafe("./media/series")).toBe("./media/series")
            expect(upath.normalizeTrim("./media/series/")).toBe("./media/series")
            expect(upath.joinSafe("./media", "series")).toBe("./media/series")
        })
    })
})
