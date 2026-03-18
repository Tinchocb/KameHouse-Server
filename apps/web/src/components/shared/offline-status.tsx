import React, { useEffect, useState } from "react"
import { WifiOff, Wifi } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { AnimatePresence, motion } from "framer-motion"

export const OfflineStatus: React.FC = () => {
    const [isOffline, setIsOffline] = useState(!navigator.onLine)
    const [showReconnected, setShowReconnected] = useState(false)

    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false)
            setShowReconnected(true)
            const timer = setTimeout(() => setShowReconnected(false), 3000)
            return () => clearTimeout(timer)
        }
        const handleOffline = () => {
            setIsOffline(true)
            setShowReconnected(false)
        }

        window.addEventListener("online", handleOnline)
        window.addEventListener("offline", handleOffline)

        return () => {
            window.removeEventListener("online", handleOnline)
            window.removeEventListener("offline", handleOffline)
        }
    }, [])

    return (
        <AnimatePresence>
            {isOffline && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
                >
                    <div className="flex items-center gap-3 px-6 py-2.5 bg-rose-500/20 backdrop-blur-md border border-rose-500/30 rounded-full shadow-[0_0_30px_rgba(244,63,94,0.3)]">
                        <div className="relative">
                            <WifiOff className="w-4 h-4 text-rose-500" />
                            <motion.div 
                                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute inset-0 bg-rose-500 rounded-full"
                            />
                        </div>
                        <span className="text-[10px] font-black tracking-[0.2em] text-rose-500 uppercase">
                            Sin Conexión
                        </span>
                    </div>
                </motion.div>
            )}

            {showReconnected && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
                >
                    <div className="flex items-center gap-3 px-6 py-2.5 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                        <Wifi className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-black tracking-[0.2em] text-emerald-500 uppercase">
                            Conexión Restaurada
                        </span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
