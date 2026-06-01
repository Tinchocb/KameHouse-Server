"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { FaMusic, FaVolumeMute } from "react-icons/fa"
import { cn } from "@/components/ui/core/styling"

export function BackgroundMusicPlayer() {
    const { bgMusicEnabled, setBgMusicEnabled, bgMusicVolume, isVideoActive } = useAppStore(
        useShallow((state) => ({
            bgMusicEnabled: state.bgMusicEnabled,
            setBgMusicEnabled: state.setBgMusicEnabled,
            bgMusicVolume: state.bgMusicVolume,
            isVideoActive: state.isVideoActive,
        }))
    )
    
    const audioRef = React.useRef<HTMLAudioElement | null>(null)
    const [isPlaying, setIsPlaying] = React.useState(false)

    // Sync volume when bgMusicVolume changes (using quadratic curve for natural logarithmic hearing)
    React.useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = Math.pow(bgMusicVolume, 2)
        }
    }, [bgMusicVolume])

    // Sync audio state with store preferences and video active state
    React.useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio("/sounds/the-meteor.flac")
            audioRef.current.loop = true
            audioRef.current.volume = Math.pow(bgMusicVolume, 2)
        }

        const audio = audioRef.current

        const playAudio = () => {
            audio.play()
                .then(() => {
                    setIsPlaying(true)
                })
                .catch((err) => {
                    console.log("Autoplay blocked or playback interrupted:", err)
                    setIsPlaying(false)
                })
        }

        const pauseAudio = () => {
            audio.pause()
            setIsPlaying(false)
        }

        // If enabled and no video is playing, start background music
        if (bgMusicEnabled && !isVideoActive) {
            playAudio()
        } else {
            pauseAudio()
        }

        // Clean up on unmount (keep instance but pause)
        return () => {
            audio.pause()
        }
    }, [bgMusicEnabled, isVideoActive])

    // Handle user interaction click to override browser autoplay blocks
    React.useEffect(() => {
        if (!bgMusicEnabled || isVideoActive) return

        const handleFirstInteraction = () => {
            if (audioRef.current && audioRef.current.paused) {
                audioRef.current.play()
                    .then(() => {
                        setIsPlaying(true)
                        removeInteractionListeners()
                    })
                    .catch(() => {})
            }
        }

        const removeInteractionListeners = () => {
            window.removeEventListener("click", handleFirstInteraction)
            window.removeEventListener("keydown", handleFirstInteraction)
        }

        window.addEventListener("click", handleFirstInteraction, { passive: true })
        window.addEventListener("keydown", handleFirstInteraction, { passive: true })

        return () => {
            removeInteractionListeners()
        }
    }, [bgMusicEnabled, isVideoActive])

    const togglePlayback = () => {
        const nextState = !bgMusicEnabled
        setBgMusicEnabled(nextState)
        
        // Immediate toggle feedback
        if (audioRef.current) {
            if (nextState && !isVideoActive) {
                audioRef.current.play()
                    .then(() => setIsPlaying(true))
                    .catch(() => setIsPlaying(false))
            } else {
                audioRef.current.pause()
                setIsPlaying(false)
            }
        }
    }

    return (
        <div className="relative flex items-center justify-center">
            {/* Custom keyframes injected locally */}
            <style>{`
                @keyframes soundwave {
                    0%, 100% { height: 4px; }
                    50% { height: 16px; }
                }
                .animate-soundwave-1 { animation: soundwave 0.8s ease-in-out infinite; }
                .animate-soundwave-2 { animation: soundwave 0.5s ease-in-out infinite 0.15s; }
                .animate-soundwave-3 { animation: soundwave 0.7s ease-in-out infinite 0.3s; }
                .animate-soundwave-4 { animation: soundwave 0.6s ease-in-out infinite 0.45s; }
            `}</style>

            <motion.button
                id="bg-music-toggle-btn"
                onClick={togglePlayback}
                title={bgMusicEnabled ? "Silenciar música de fondo" : "Activar música de fondo"}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-2xl border transition-all duration-500 group relative overflow-hidden backdrop-blur-md",
                    bgMusicEnabled && isPlaying && !isVideoActive
                        ? "border-brand-orange/40 bg-brand-orange/10 text-brand-orange shadow-[0_0_20px_rgba(255,110,58,0.25)]"
                        : "border-white/5 text-zinc-500 hover:bg-white/5 hover:text-white hover:border-white/20"
                )}
            >
                <AnimatePresence mode="wait">
                    {bgMusicEnabled && isPlaying && !isVideoActive ? (
                        <motion.div
                            key="playing"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="flex items-end gap-[2px] h-4 z-10"
                        >
                            <div className="w-[2px] bg-brand-orange rounded-full animate-soundwave-1" />
                            <div className="w-[2px] bg-brand-orange rounded-full animate-soundwave-2" />
                            <div className="w-[2px] bg-brand-orange rounded-full animate-soundwave-3" />
                            <div className="w-[2px] bg-brand-orange rounded-full animate-soundwave-4" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="paused"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="z-10"
                        >
                            {bgMusicEnabled ? (
                                <FaMusic className="w-4 h-4 text-zinc-400 animate-pulse" />
                            ) : (
                                <FaVolumeMute className="w-5 h-5 text-zinc-500" />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
                
                {/* Aura overlay */}
                {bgMusicEnabled && isPlaying && !isVideoActive && (
                    <div className="absolute inset-0 bg-brand-orange/5 animate-pulse pointer-events-none" />
                )}
            </motion.button>
        </div>
    )
}
