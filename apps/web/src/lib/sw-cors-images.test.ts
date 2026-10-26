import { describe, expect, it } from "vitest"
import { shouldFetchImageWithCors } from "./sw-cors-images"

const TAURI = "http://tauri.localhost"

describe("shouldFetchImageWithCors", () => {
    it("pide en CORS las imágenes del servidor local cuando la página es de otro origen", () => {
        expect(shouldFetchImageWithCors("http://127.0.0.1:43211/api/v1/image-proxy?url=x", "no-cors", TAURI)).toBe(true)
        expect(shouldFetchImageWithCors("http://127.0.0.1:43211/api/v1/video-thumbnail?path=a&v=1", "no-cors", TAURI)).toBe(true)
        expect(shouldFetchImageWithCors("http://192.168.1.20:43211/api/v1/thumbnail/abc", "no-cors", TAURI)).toBe(true)
    })

    it("también las de TMDB pedidas directo", () => {
        expect(shouldFetchImageWithCors("https://image.tmdb.org/t/p/w300/a.jpg", "no-cors", TAURI)).toBe(true)
    })

    it("no toca el mismo origen: ya es una respuesta basic", () => {
        expect(shouldFetchImageWithCors("http://127.0.0.1:43211/api/v1/image-proxy?url=x", "no-cors", "http://127.0.0.1:43211")).toBe(false)
    })

    it("no toca pedidos que ya son CORS ni otros tipos de pedido", () => {
        expect(shouldFetchImageWithCors("http://127.0.0.1:43211/api/v1/image-proxy?url=x", "cors", TAURI)).toBe(false)
        expect(shouldFetchImageWithCors("http://127.0.0.1:43211/api/v1/image-proxy?url=x", "navigate", TAURI)).toBe(false)
    })

    it("no toca el resto de la API ni hosts ajenos", () => {
        expect(shouldFetchImageWithCors("http://127.0.0.1:43211/api/v1/library/collection", "no-cors", TAURI)).toBe(false)
        expect(shouldFetchImageWithCors("https://example.com/api/v1/other", "no-cors", TAURI)).toBe(false)
        expect(shouldFetchImageWithCors("https://example.com/poster.jpg", "no-cors", TAURI)).toBe(false)
    })

    it("tolera URLs inválidas", () => {
        expect(shouldFetchImageWithCors("no es una url", "no-cors", TAURI)).toBe(false)
    })
})
