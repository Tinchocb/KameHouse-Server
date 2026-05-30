import React, { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Tv, X, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/components/ui/core/styling"
import { buildSeaQuery } from "@/api/client/requests"

interface PlayerCastModalProps {
    isOpen: boolean
    onClose: () => void
    playableUrl: string
    title?: string
    serverIPs?: string[]
    serverPort?: number
    absoluteLanUrl?: string
}

export function PlayerCastModal({
    isOpen,
    onClose,
    playableUrl,
    title,
    serverIPs,
    serverPort,
    absoluteLanUrl,
}: PlayerCastModalProps) {
    const [discoveredTvs, setDiscoveredTvs] = React.useState<{ ip: string; name: string }[]>([])
    const [pairedTvs, setPairedTvs] = React.useState<{ ip: string; name: string; wifi_mac?: string; ethernet_mac?: string }[]>([])
    const [isDiscovering, setIsDiscovering] = React.useState(false)
    const [castingTvIp, setCastingTvIp] = React.useState<string | null>(null)

    const localServerUrl = React.useMemo(() => {
        if (typeof window === "undefined") return "http://localhost:43211"

        // Prefer backend IPs and Port provided by the server status
        if (serverIPs && serverIPs.length > 0) {
            const lanIp = serverIPs.find(ip =>
                ip.startsWith("192.168.") ||
                ip.startsWith("10.") ||
                ip.startsWith("172.")
            ) || serverIPs[0]
            const port = serverPort || 43211
            return `http://${lanIp}:${port}`
        }

        const hostname = window.location.hostname
        const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"

        // Si ya se accede desde una IP de red local, usar esa URL directamente.
        if (!isLocalhost) {
            return window.location.origin
        }

        // Último recurso
        return "http://localhost:43211"
    }, [serverIPs, serverPort])

    const fetchPairedTvs = React.useCallback(async () => {
        try {
            const result = await buildSeaQuery<{ ip: string; name: string; wifi_mac?: string; ethernet_mac?: string }[]>({
                endpoint: "/api/v1/cast/samsung/paired",
                method: "GET",
            })
            setPairedTvs(result || [])
        } catch (err) {
            console.error("Error fetching paired TVs:", err)
        }
    }, [])

    const discoverTvs = React.useCallback(async () => {
        setIsDiscovering(true)
        try {
            await fetchPairedTvs()
            const result = await buildSeaQuery<{ ip: string; name: string }[]>({
                endpoint: "/api/v1/cast/samsung/discover",
                method: "GET",
            })
            setDiscoveredTvs(result || [])
        } catch (err) {
            console.error("Error discovering TVs:", err)
            toast.error("Error al buscar Smart TVs en la red")
        } finally {
            setIsDiscovering(false)
        }
    }, [fetchPairedTvs])

    const allTvs = React.useMemo(() => {
        const list: { ip: string; name: string; isOnline: boolean }[] = []
        discoveredTvs.forEach(tv => {
            list.push({ ip: tv.ip, name: tv.name, isOnline: true })
        })
        pairedTvs.forEach(ptv => {
            if (!list.some(tv => tv.ip === ptv.ip)) {
                list.push({ ip: ptv.ip, name: ptv.name, isOnline: false })
            }
        })
        return list
    }, [discoveredTvs, pairedTvs])

    const handleCastToSamsung = async (ip: string, name: string) => {
        setCastingTvIp(ip)
        try {
            const absoluteStreamUrl = absoluteLanUrl || (playableUrl.startsWith("http")
                ? playableUrl
                : `${localServerUrl}${playableUrl}`)
            const castUrl = `${localServerUrl}/api/v1/cast/player?url=${encodeURIComponent(absoluteStreamUrl)}&title=${encodeURIComponent(title || "KameHouse")}`

            console.log("[CAST DEBUG] Sending cast URL to Samsung TV:", castUrl)

            const result = await buildSeaQuery<{ success: boolean }, { ip: string; url: string }>({
                endpoint: "/api/v1/cast/samsung/launch",
                method: "POST",
                data: {
                    ip,
                    url: castUrl,
                },
            })
            if (result?.success) {
                toast.success(`Transmitiendo a ${name}`)
            } else {
                toast.error(`No se pudo iniciar la transmisión en ${name}`)
            }
        } catch (err: any) {
            console.error("Error casting to Samsung TV:", err)
            toast.error(err?.message || `Error al transmitir a ${name}`)
        } finally {
            setCastingTvIp(null)
        }
    }

    useEffect(() => {
        if (isOpen) {
            discoverTvs()
        }
    }, [isOpen, discoverTvs])

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-md pointer-events-auto"
                    />

                    {/* Modal container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.5 }}
                        className="absolute inset-0 m-auto w-full max-w-lg h-fit max-h-[90vh] overflow-y-auto z-[210] bg-zinc-900/95 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] pointer-events-auto select-none flex flex-col gap-6 text-left"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
                            <h3 className="text-sm font-black tracking-[0.25em] text-white uppercase flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
                                TRANSMITIR A PANTALLA
                            </h3>
                            <button
                                onClick={onClose}
                                className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content options */}
                        <div className="space-y-5">

                            {/* Samsung Smart TV Casting */}
                            <div className="p-5 rounded-2xl bg-brand-orange/[0.02] border border-brand-orange/20 transition-all duration-300 flex flex-col gap-4">
                                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                    <div className="flex gap-3 items-center">
                                        <Tv className="w-4 h-4 text-brand-orange" />
                                        <h4 className="text-xs font-bold text-white tracking-wider uppercase">
                                            Samsung Smart TV
                                        </h4>
                                    </div>
                                    <button
                                        onClick={() => discoverTvs()}
                                        disabled={isDiscovering}
                                        className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                                        title="Buscar TVs nuevamente"
                                    >
                                        <RefreshCw className={cn("w-3.5 h-3.5", isDiscovering && "animate-spin")} />
                                    </button>
                                </div>

                                {isDiscovering ? (
                                    <div className="py-6 flex flex-col items-center justify-center gap-3">
                                        <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
                                        <p className="text-[10px] text-zinc-400 font-sans tracking-normal normal-case">
                                            Buscando Smart TVs en la red local...
                                        </p>
                                    </div>
                                ) : allTvs.length > 0 ? (
                                    <div className="space-y-2">
                                        {allTvs.map((tv) => (
                                            <div
                                                key={tv.ip}
                                                onClick={() => castingTvIp === null && handleCastToSamsung(tv.ip, tv.name)}
                                                className={cn(
                                                    "p-3.5 rounded-xl border transition-all duration-300 flex justify-between items-center group cursor-pointer",
                                                    castingTvIp === tv.ip
                                                        ? "bg-brand-orange/10 border-brand-orange/40 text-brand-orange"
                                                        : tv.isOnline
                                                            ? "bg-zinc-950/40 border-white/5 hover:border-brand-orange/30 hover:bg-brand-orange/[0.02] text-white"
                                                            : "bg-zinc-950/10 border-white/[0.03] opacity-60 hover:opacity-100 hover:border-brand-orange/20 hover:bg-brand-orange/[0.01] text-zinc-400 hover:text-white"
                                                )}
                                            >
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold tracking-wide">{tv.name}</span>
                                                        <span className={cn(
                                                            "w-1.5 h-1.5 rounded-full shrink-0",
                                                            tv.isOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                                                        )} />
                                                    </div>
                                                    <span className="text-[9px] text-zinc-500 font-mono tracking-tight">
                                                        {tv.ip} {!tv.isOnline && "· En espera (WoL)"}
                                                    </span>
                                                </div>
                                                {castingTvIp === tv.ip ? (
                                                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-brand-orange">
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        {tv.isOnline ? "Transmitiendo..." : "Encendiendo TV..."}
                                                    </div>
                                                ) : (
                                                    <div className={cn(
                                                        "px-2.5 py-1 rounded-md transition-all text-[9px] font-black uppercase tracking-wider border",
                                                        tv.isOnline
                                                            ? "bg-zinc-900 border-white/10 group-hover:border-brand-orange/30 group-hover:bg-brand-orange/10 text-zinc-400 group-hover:text-brand-orange"
                                                            : "bg-zinc-900/50 border-white/5 group-hover:border-brand-orange/20 group-hover:bg-brand-orange/5 text-zinc-500 group-hover:text-zinc-300"
                                                    )}>
                                                        {tv.isOnline ? "Transmitir" : "Encender"}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-zinc-500 leading-relaxed font-sans normal-case tracking-normal">
                                        No se detectaron Smart TVs Samsung automáticamente. Asegúrate de que estén encendidos y conectados a la misma red Wi-Fi.
                                    </p>
                                )}
                            </div>

                            {/* Manual Alternative Casting */}
                            <div className="p-5 rounded-2xl bg-zinc-950/40 border border-white/5 transition-all duration-300 flex flex-col gap-4">
                                <div className="flex gap-3 items-center border-b border-white/5 pb-3">
                                    <Tv className="w-4 h-4 text-zinc-400" />
                                    <h4 className="text-xs font-bold text-white tracking-wider uppercase">
                                        Método Alternativo (Cualquier TV)
                                    </h4>
                                </div>
                                <p className="text-[10px] text-zinc-400 leading-relaxed font-sans normal-case tracking-normal">
                                    Si la transmisión automática falla o usas otra marca de Smart TV:
                                </p>
                                <ol className="list-decimal pl-4 space-y-1.5 text-[10px] text-zinc-400 font-sans normal-case tracking-normal">
                                    <li>Abre el navegador web de tu Smart TV.</li>
                                    <li>Escribe la siguiente dirección directamente:</li>
                                </ol>
                                <div className="p-3.5 bg-zinc-950/60 border border-white/5 rounded-xl flex items-center justify-between gap-3 font-mono text-[11px] text-brand-orange select-all font-bold">
                                    <span>{localServerUrl}/go</span>
                                </div>
                                <p className="text-[9px] text-zinc-500 leading-relaxed font-sans normal-case tracking-normal italic border-t border-white/5 pt-2">
                                    Tip: Guarda esta dirección en los favoritos del navegador de tu TV. La próxima vez, solo inicia la reproducción de un video, abre el favorito en la TV y se reproducirá al instante.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
