import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"
import createFetchMock from "vitest-fetch-mock"

const fetchMocker = createFetchMock(vi)
fetchMocker.enableMocks()

// Auto-cleanup after each test
afterEach(() => {
    cleanup()
})

// Mock ResizeObserver which is missing in jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}))

// Mock localStorage for Node 22+ happy-dom compatibility
const createStorageMock = () => {
    const store = new Map<string, string>()
    return {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store.set(key, String(value))
        }),
        removeItem: vi.fn((key: string) => {
            store.delete(key)
        }),
        clear: vi.fn(() => {
            store.clear()
        }),
        key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
        get length() {
            return store.size
        },
    }
}
const storageMock = createStorageMock()
Object.defineProperty(globalThis, "localStorage", {
    value: storageMock,
    writable: true,
    configurable: true,
})
if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
        value: storageMock,
        writable: true,
        configurable: true,
    })
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }),
})
