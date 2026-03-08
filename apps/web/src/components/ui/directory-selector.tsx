import React, { useState, useEffect } from "react"
import { useDirectorySelector } from "@/api/hooks/directory_selector.hooks"
import { Modal } from "@/components/ui/modal/modal"
import { Button } from "@/components/ui/button"
import { TextInput } from "@/components/ui/text-input/text-input"
import { FaFolder, FaFolderOpen, FaArrowLeft, FaCheck } from "react-icons/fa"

export function DirectorySelector({
    open,
    onOpenChange,
    onSelect
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSelect: (path: string) => void
}) {
    const [currentPath, setCurrentPath] = useState("")
    const [debouncedPath, setDebouncedPath] = useState("")

    // Debounce the input to avoid spamming the backend
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedPath(currentPath), 300)
        return () => clearTimeout(handler)
    }, [currentPath])

    const { data, isLoading } = useDirectorySelector(debouncedPath)

    const handleNavigate = (newPath: string) => {
        setCurrentPath(newPath)
    }

    const handleUp = () => {
        const parts = currentPath.split(/[/\\]/).filter(Boolean)
        if (parts.length > 0) {
            parts.pop()
            let parent = parts.join("/")
            // En Windows, si solo queda la letra de la unidad (ej. "C:"), agregamos barra
            if (parent.length === 2 && parent.endsWith(":")) {
                parent += "/"
            } else if (parent === "") {
                parent = "/"
            }
            setCurrentPath(parent)
        } else {
            setCurrentPath("/")
        }
    }

    const handleConfirm = () => {
        if (currentPath) {
            onSelect(currentPath)
            onOpenChange(false)
        }
    }

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="Seleccionar Carpeta"
            description="Navega y selecciona la carpeta que deseas agregar a tu biblioteca."
            contentClass="max-w-2xl bg-[#0B0B0F] border-[#1C1C28]"
        >
            <div className="flex flex-col gap-4 mt-4">
                <div className="flex gap-2">
                    <Button
                        intent="gray"
                        onClick={handleUp}
                        disabled={!currentPath || currentPath === "/"}
                        className="px-3 bg-[#1C1C28] border-transparent hover:bg-[#252535]"
                    >
                        <FaArrowLeft />
                    </Button>
                    <TextInput
                        value={currentPath}
                        onValueChange={setCurrentPath}
                        placeholder="Ruta (ej. C:/Anime o /mnt/media)"
                        className="flex-1 bg-[#1C1C28] border-transparent focus:border-orange-500 rounded-md"
                        intent="unstyled"
                        size="md"
                    />
                </div>

                <div className="flex-1 min-h-[300px] max-h-[400px] overflow-y-auto bg-[#151520] border border-[#1C1C28] rounded-lg p-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-orange-500 animate-pulse">
                            Cargando...
                        </div>
                    ) : (data?.Directories && data.Directories.length > 0) ? (
                        <ul className="space-y-1">
                            {data.Directories.map((dir) => (
                                <li key={dir.Path}>
                                    <button
                                        onClick={() => handleNavigate(dir.Path!)}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-300 hover:text-white hover:bg-[#1C1C28] rounded-md transition-colors"
                                    >
                                        <FaFolder className="text-orange-400" />
                                        <span className="truncate">{dir.Name}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            No se encontraron carpetas, o ingresa una unidad para comenzar (Ej. C:/)
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-2">
                    <Button
                        intent="gray"
                        onClick={() => onOpenChange(false)}
                        className="bg-transparent text-gray-400 hover:text-white"
                    >
                        Cancelar
                    </Button>
                    <Button
                        intent="primary"
                        onClick={handleConfirm}
                        disabled={!currentPath}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center gap-2"
                    >
                        <FaCheck /> Seleccionar
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
