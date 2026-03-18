import { ScanLogViewer } from "@/app/scan-log-viewer/scan-log-viewer"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { BiTrash, BiUpload } from "react-icons/bi"
import { LuFileSearch, LuTrash2, LuUploadCloud, LuZap } from "react-icons/lu"
import { toast } from "sonner"
import { cn } from "@/components/ui/core/styling"

const DB_NAME = "kamehouse-scan-logs-db"
const STORE_NAME = "logs"
const KEY = "latest_log"

const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME)
            }
        }
    })
}

const saveLogToDB = async (content: string) => {
    try {
        const db = await initDB()
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite")
            const store = tx.objectStore(STORE_NAME)
            const request = store.put(content, KEY)
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }
    catch (error) {
        console.error("Failed to save log to DB:", error)
        toast.error("Error al guardar en el almacenamiento local")
    }
}

const getLogFromDB = async (): Promise<string | null> => {
    try {
        const db = await initDB()
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly")
            const store = tx.objectStore(STORE_NAME)
            const request = store.get(KEY)
            request.onsuccess = () => resolve(request.result || null)
            request.onerror = () => reject(request.error)
        })
    }
    catch (error) {
        console.error("Failed to get log from DB:", error)
        return null
    }
}

const clearLogFromDB = async () => {
    try {
        const db = await initDB()
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite")
            const store = tx.objectStore(STORE_NAME)
            const request = store.delete(KEY)
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }
    catch (error) {
        console.error("Failed to clear log from DB:", error)
    }
}

export default function Page() {
    const [content, setContent] = useState<string>("")
    const [isDragging, setIsDragging] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const dragCounter = useRef(0)

    // Load saved log on mount
    useEffect(() => {
        getLogFromDB().then((savedContent) => {
            if (savedContent) {
                setContent(savedContent)
                toast.success("Registro de escaneo restaurado")
            }
            setIsLoading(false)
        })
    }, [])

    const readFile = useCallback((file: File) => {
        const reader = new FileReader()
        reader.onload = async (e) => {
            const result = e.target?.result as string
            setContent(result)
            toast.promise(saveLogToDB(result), {
                loading: "Analizando fragmentos...",
                success: "Registro persistido exitosamente",
                error: "Error al sincronizar el registro",
            })
        }
        reader.readAsText(file)
    }, [])

    const handleClear = useCallback(async () => {
        await clearLogFromDB()
        setContent("")
        toast.success("Registro eliminado de la bóveda")
    }, [])

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) readFile(file)
    }

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current++
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current--
        if (dragCounter.current === 0) {
            setIsDragging(false)
        }
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        dragCounter.current = 0

        const file = e.dataTransfer.files?.[0]
        if (file) readFile(file)
    }, [readFile])

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <LuZap className="w-8 h-8 text-primary animate-pulse" />
                <p className="font-bebas text-xl tracking-[0.2em] text-zinc-500">ACCEDIENDO A LA BÓVEDA...</p>
            </div>
        )
    }

    return (
        <div
            className="flex-1 w-full min-h-screen bg-background text-zinc-200 selection:bg-primary/30"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* ── Cinematic Drop Overlay ── */}
            <div className={cn(
                "fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-2xl transition-all duration-500 pointer-events-none",
                isDragging ? "opacity-100 scale-100" : "opacity-0 scale-105"
            )}>
                <div className="flex flex-col items-center gap-6 p-16 rounded-[40px] border-2 border-dashed border-primary/40 bg-primary/5 shadow-[0_0_100px_rgba(249,115,22,0.1)]">
                    <div className="relative">
                        <LuUploadCloud className="w-24 h-24 text-primary animate-bounce-subtle" />
                        <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                        <h2 className="font-bebas text-5xl tracking-[0.05em] text-white">DEPOSITAR REGISTRO</h2>
                        <p className="text-sm font-bold text-primary tracking-widest uppercase opacity-70">Suelta el archivo para iniciar el análisis</p>
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-6 md:px-14 pt-12 pb-24">
                {/* ── Header Wrapper ── */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-[2px] w-8 bg-primary shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/80 italic">Data Forensics</span>
                        </div>
                        <h1 className="font-bebas text-6xl md:text-8xl leading-none tracking-tight text-white m-0">
                            ANALIZADOR DE <span className="text-transparent stroke-text opacity-40">LOGS</span>
                        </h1>
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest max-w-lg">
                            Herramienta de diagnóstico profundo para la traza de escaneo y sincronización de metadatos.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="group relative flex items-center gap-3 px-6 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-xl cursor-pointer transition-all duration-300 shadow-xl active:scale-95">
                            <LuFileSearch className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                            <span className="font-bebas text-lg tracking-[0.1em] text-white">
                                {content ? "CAMBIAR ORIGEN" : "CARGAR REGISTRO"}
                            </span>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".log,.txt"
                                className="hidden"
                            />
                            <div className="absolute -bottom-1 left-4 right-4 h-[2px] bg-primary opacity-0 group-hover:opacity-100 transition-opacity blur-[1px]" />
                        </label>

                        {content && (
                            <button
                                onClick={handleClear}
                                className="p-3 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all duration-300"
                                title="Limpiar bóveda"
                            >
                                <LuTrash2 className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Main Viewport ── */}
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                    <ScanLogViewer content={content} />
                </div>
            </div>

            <style>{`
                .stroke-text {
                    -webkit-text-stroke: 1.5px white;
                }
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-bounce-subtle {
                    animation: bounce-subtle 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    )
}
