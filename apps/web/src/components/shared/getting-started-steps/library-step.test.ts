import { describe, expect, it } from "vitest"
import { addFolderLabel } from "./library-step"

describe("addFolderLabel", () => {
    it("usa «Añadir carpeta» la primera vez", () => {
        expect(addFolderLabel(0)).toBe("Añadir carpeta")
    })

    it("usa «Añadir otra carpeta» cuando ya hay una", () => {
        expect(addFolderLabel(1)).toBe("Añadir otra carpeta")
        expect(addFolderLabel(3)).toBe("Añadir otra carpeta")
    })
})
