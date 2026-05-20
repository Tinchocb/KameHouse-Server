import { useState, memo, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VhsCollectionItem {
    id: string | number
    title: string
    episodesCount?: number
    watchedCount?: number
    genres?: string[]
    year?: string | number
    status?: "Completado" | "En progreso" | "Sin comenzar"
    isNew?: boolean
    color?: string
    posterUrl?: string
    bannerUrl?: string
    description?: string
}

interface VhsCollectionProps {
    items: VhsCollectionItem[]
    onItemClick: (item: VhsCollectionItem) => void
    className?: string
    onHoverItem?: (item: VhsCollectionItem | null) => void
    activeColor?: string
    selectedId?: string | number | null
    onSelectId?: (id: string | number | null) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Helper to generate a consistent color from string
const stringToColor = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const h = Math.abs(hash % 360)
    return `hsl(${h}, 60%, 40%)`
}

const getSeriesColor = (title: string) => {
    const t = title.toLowerCase()
    if (t.includes('super')) return '#1a4a8a' // Azul oscuro
    if (t.includes('kai')) return '#1a5c2e' // Verde
    if (t.includes('gt')) return '#2980b9' // Azul claro
    if (t.includes('daima')) return '#0e6655' // Esmeralda oscuro
    if (t.includes('dragon ball z') || t === 'dbz') return '#b51f1f' // Rojo
    if (t.includes('dragon ball')) return '#d96c14' // Naranja clásico
    return stringToColor(title)
}

const VhsTapeCard = memo(({ 
    item, 
    isSelected, 
    onClick,
    onPlayClick,
    onMouseEnter,
    onMouseLeave
}: { 
    item: VhsCollectionItem
    isSelected: boolean
    onClick: () => void
    onPlayClick: () => void
    onMouseEnter?: () => void
    onMouseLeave?: () => void
}) => {
    const baseColor = item.color || getSeriesColor(item.title)
    const progress = item.episodesCount ? (item.watchedCount || 0) / item.episodesCount * 100 : 0

    // Dynamic 3D interactive physics tilt state
    const [tilt, setTilt] = useState({ x: 0, y: 0 })
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
    const [hovered, setHovered] = useState(false)

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        setCursorPos({ x, y })
        
        // Calculate tilt between -10 and 10 degrees for elegant motion
        const normalizedX = (x / rect.width) * 2 - 1
        const normalizedY = (y / rect.height) * 2 - 1
        setTilt({
            x: -normalizedY * 10, // Rotate X (tilt forward/backward)
            y: normalizedX * 10,   // Rotate Y (turn left/right)
        })
    }

    const handleMouseEnterLocal = () => {
        setHovered(true)
        onMouseEnter?.()
    }

    const handleMouseLeaveLocal = () => {
        setHovered(false)
        setTilt({ x: 0, y: 0 })
        onMouseLeave?.()
    }

    // Skeuomorphic retro branding config
    const retro = useMemo(() => {
        const t = item.title.toLowerCase()
        let code = "KH-01"
        let brand = "TDK"
        let tapeModel = "HS 120"
        let speed = "SP"
        let handwrittenColor = "#1a365d" // Faded retro blue ink
        let handwrittenFont = "'Caveat', cursive"
        
        const idNum = typeof item.id === 'number' ? item.id : String(item.id).charCodeAt(0)
        
        // Calculate dynamic winding spool sizes based on real watched progress!
        const maxSpoolWidth = 8.0 // 8px maximum spool
        const minSpoolWidth = 1.0 // 1px minimum spool (just the hub exposed)
        const leftSpoolWidth = maxSpoolWidth - ((progress / 100) * (maxSpoolWidth - minSpoolWidth))
        const rightSpoolWidth = minSpoolWidth + ((progress / 100) * (maxSpoolWidth - minSpoolWidth))
        
        let hasBeKindSticker = idNum % 3 === 0
        let hasColoredDot = idNum % 2 === 0
        let hasRentalStamp = idNum % 4 === 0 // 25% chance of a vintage shop price label
        const dotColors = ["#adff2f", "#ff007f", "#ff9d5c", "#00f0ff"]
        const coloredDotColor = dotColors[idNum % dotColors.length]
        const coloredDotText = `V-${(idNum % 20) + 10}`

        if (t.includes('super')) {
            code = "KHM-DBS-04"
            brand = "MAXELL"
            tapeModel = "UR 120"
            speed = "EP"
            handwrittenColor = "#111827" // Black sharpie marker
            handwrittenFont = "'Caveat', cursive"
        } else if (t.includes('gt')) {
            code = "KHM-GT-03"
            brand = "SONY"
            tapeModel = "UX-S 90"
            speed = "SP"
            handwrittenColor = "#991b1b" // Red felt-tip pen
            handwrittenFont = "'Shadows Into Light', cursive"
        } else if (t.includes('z')) {
            code = "KHM-DBZ-02"
            brand = "TDK"
            tapeModel = "SA 90"
            speed = "EP"
            handwrittenColor = "#1e3a8a" // Faded dark blue ink
            handwrittenFont = "'Caveat', cursive"
        } else if (t.includes('daima')) {
            code = "KHM-DBD-05"
            brand = "BASF"
            tapeModel = "Chrome II"
            speed = "SP"
            handwrittenColor = "#111827" // Black pen
            handwrittenFont = "'Nanum Pen Script', cursive"
        } else if (t.includes('dragon ball')) {
            code = "KHM-DB-01"
            brand = "JVC"
            tapeModel = "GX 120"
            speed = "LP"
            handwrittenColor = "#065f46" // Green pen
            handwrittenFont = "'Shadows Into Light', cursive"
        }
        
        const rotationAngle = idNum % 2 === 0 ? -0.7 : 0.5

        return { 
            code, 
            brand, 
            tapeModel, 
            speed, 
            handwrittenColor, 
            handwrittenFont,
            rotationAngle,
            leftSpoolWidth,
            rightSpoolWidth,
            hasBeKindSticker,
            hasColoredDot,
            hasRentalStamp,
            coloredDotColor,
            coloredDotText
        }
    }, [item.title, item.id, progress])

    const brandStyle = useMemo(() => {
        switch (retro.brand) {
            case "TDK":
                return {
                    bg: `
                        linear-gradient(to bottom, #ef4444 0px, #ef4444 3px, #f97316 3px, #f97316 6px, #f59e0b 6px, #f59e0b 9px, transparent 9px),
                        linear-gradient(to right, transparent 16px, rgba(239, 68, 68, 0.12) 16px, rgba(239, 68, 68, 0.12) 17px, transparent 17px),
                        linear-gradient(to bottom, transparent 10px, rgba(59, 130, 246, 0.06) 10px, rgba(59, 130, 246, 0.06) 11px, transparent 11px)
                    `,
                    bgSize: "100% 100%, 100% 100%, 100% 11px",
                    paperColor: "#FAF8EE", // Yellowed aged paper
                }
            case "MAXELL":
                return {
                    bg: `
                        linear-gradient(to bottom, #111827 0px, #111827 8px, #b91c1c 8px, #b91c1c 11px, transparent 11px),
                        linear-gradient(to bottom, transparent 12px, rgba(17, 24, 39, 0.03) 12px, rgba(17, 24, 39, 0.03) 13px, transparent 13px)
                    `,
                    bgSize: "100% 100%, 100% 14px",
                    paperColor: "#FFFDF6", // Slightly warmer cream
                }
            case "SONY":
                return {
                    bg: `
                        linear-gradient(135deg, #1f2937 0px, #1f2937 12px, #dc2626 12px, #dc2626 15px, transparent 15px),
                        linear-gradient(to right, transparent 20px, rgba(220, 38, 38, 0.1) 20px, rgba(220, 38, 38, 0.1) 21px, transparent 21px)
                    `,
                    bgSize: "100% 100%, 100% 100%",
                    paperColor: "#F4F3ED", // Vintage grey-white
                }
            case "BASF":
                return {
                    bg: `
                        linear-gradient(to bottom, #1e3a8a 0px, #1e3a8a 4px, #3b82f6 4px, #3b82f6 7px, transparent 7px)
                    `,
                    bgSize: "100% 100%",
                    paperColor: "#EBF8EF", // Aged soft green-white
                }
            case "JVC":
                return {
                    bg: `
                        linear-gradient(to bottom, #06b6d4 0px, #06b6d4 3px, #ec4899 3px, #ec4899 6px, #eab308 6px, #eab308 9px, transparent 9px),
                        linear-gradient(to bottom, transparent 11px, rgba(17, 24, 39, 0.04) 11px, rgba(17, 24, 39, 0.04) 12px, transparent 12px)
                    `,
                    bgSize: "100% 100%, 100% 12px",
                    paperColor: "#FFFDF0", // Golden warm paper
                }
            default:
                return {
                    bg: `
                        linear-gradient(to right, transparent 16px, rgba(239, 68, 68, 0.15) 16px, rgba(239, 68, 68, 0.15) 17px, transparent 17px),
                        linear-gradient(to bottom, transparent 9px, rgba(59, 130, 246, 0.08) 9px, rgba(59, 130, 246, 0.08) 10px, transparent 10px)
                    `,
                    bgSize: "100% 100%, 100% 10px",
                    paperColor: "#FAF8F0",
                }
        }
    }, [retro.brand])

    // Dynamic HSL status accent glowing stripe colors
    const statusAccentClass = 
        item.status === "Completado" ? "bg-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.7)]" :
        item.status === "En progreso" ? "bg-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.7)]" :
        "bg-brand-orange shadow-[0_0_10px_rgba(255,107,0,0.5)]"

    return (
        <div 
            onClick={onClick}
            onMouseEnter={handleMouseEnterLocal}
            onMouseLeave={handleMouseLeaveLocal}
            onMouseMove={handleMouseMove}
            className={cn(
                "h-full flex flex-col cursor-pointer border-r-[0.5px] border-black/40 min-w-[100px] sm:min-w-[140px] shrink-0 relative rounded-t-md",
                isSelected 
                    ? "flex-[2.5] min-w-[280px] sm:min-w-[360px] z-30 animate-[vhs-pop-in_0.5s_cubic-bezier(0.16,1,0.3,1)]" 
                    : "flex-1 z-10"
            )}
            style={{
                transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(${isSelected ? '-48px' : hovered ? '-24px' : '0px'}) scale(${hovered && !isSelected ? 1.04 : 1})`,
                boxShadow: isSelected 
                    ? `0 45px 85px -10px rgba(0,0,0,0.98), 0 0 45px ${baseColor}50, inset 0 0 1px rgba(255,255,255,0.3)` 
                    : hovered 
                        ? `0 35px 65px -12px rgba(0,0,0,0.95), 0 0 25px ${baseColor}40, 6px 12px 24px rgba(0,0,0,0.4)`
                        : "0 6px 16px rgba(0,0,0,0.65), 1px 2px 4px rgba(0,0,0,0.3)",
                transition: hovered 
                    ? "transform 0.08s ease-out, box-shadow 0.15s ease-out, flex 0.6s cubic-bezier(0.16, 1, 0.3, 1)" 
                    : "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s cubic-bezier(0.16, 1, 0.3, 1), flex 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
        >
            {/* Satin dynamic light sweep */}
            <div 
                className="absolute inset-0 pointer-events-none z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: hovered ? `radial-gradient(circle 180px at ${cursorPos.x}px ${cursorPos.y}px, rgba(255,255,255,0.08) 0%, transparent 80%)` : 'none'
                }}
            />

            {/* Exposed inner cabinet/cartridge pocket revealed on slide-out */}
            <div 
                className="absolute left-0 right-0 z-0 pointer-events-none transition-all duration-500 flex flex-col items-center justify-center bg-gradient-to-b from-[#050507] to-[#0c0d12]"
                style={{
                    top: 'calc(100% - 150px)', // Centered right where the separator sits
                    height: '65px',
                    opacity: (hovered || isSelected) ? 1 : 0,
                    boxShadow: "inset 0 10px 10px rgba(0,0,0,0.9), inset 0 -10px 10px rgba(0,0,0,0.9)"
                }}
            >
                {/* Inner Cardboard Beige Pulp Edges */}
                <div className="absolute top-[6px] inset-x-1.5 h-[1.5px] bg-[#d2c29d]/25 shadow-[0_1px_0_rgba(0,0,0,0.5)]" />
                <div className="absolute bottom-[6px] inset-x-1.5 h-[1.5px] bg-[#d2c29d]/25 shadow-[0_-1px_0_rgba(0,0,0,0.5)]" />
                
                {/* Exposed metallic sprockets & brown magnetic tape */}
                <div className="w-[88%] h-4.5 bg-zinc-950 rounded border border-zinc-900 shadow-inner relative flex items-center justify-between px-6 overflow-hidden">
                    {/* Brown magnetic tape string inside cassette sleeve slot */}
                    <div className="absolute top-1/2 left-[10%] right-[10%] -translate-y-1/2 h-[3.5px] bg-[#3a210f] border border-[#201309] shadow-[0_1px_2px_black] z-10">
                        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.1)_50%,transparent)] bg-[size:100px_100%] animate-[tape-sheen_4s_linear_infinite]" />
                    </div>
                    {/* Left internal cog axle */}
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-800 border border-zinc-700 shadow-inner flex items-center justify-center shrink-0">
                        <div className="w-1 h-1 rounded-full bg-zinc-900" />
                    </div>
                    {/* Right internal cog axle */}
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-800 border border-zinc-700 shadow-inner flex items-center justify-center shrink-0">
                        <div className="w-1 h-1 rounded-full bg-zinc-900" />
                    </div>
                </div>
            </div>

            {/* 1. Cardboard Sleeve (Slipcase) */}
            <motion.div 
                className="flex-1 relative overflow-hidden bg-[#0d0f14] group rounded-t-md z-10"
                animate={{
                    y: isSelected ? -24 : hovered ? -12 : 0,
                }}
                transition={{ type: "spring", stiffness: 180, damping: 20 }}
            >
                {/* Fiber Cardboard Texture Overlay */}
                <div 
                    className="absolute inset-0 z-10 pointer-events-none mix-blend-overlay opacity-[0.06]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paperNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.05' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23paperNoise)'/%3E%3C/svg%3E")`
                    }}
                />

                {/* Cardboard edge creases & scuffs */}
                <div className="absolute inset-0 z-10 pointer-events-none mix-blend-screen opacity-35 bg-[linear-gradient(135deg,transparent_45%,rgba(255,255,255,0.18)_46%,rgba(255,255,255,0.28)_48%,rgba(0,0,0,0.15)_50%,transparent_52%)]" />
                <div className="absolute inset-0 z-10 pointer-events-none mix-blend-overlay opacity-25 bg-[linear-gradient(45deg,transparent_40%,rgba(255,255,255,0.12)_42%,rgba(255,255,255,0.22)_44%,rgba(0,0,0,0.2)_46%,transparent_48%)]" />

                {/* Concentric circular Ring Wear representing tape spools */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.045] z-10 mix-blend-screen bg-[radial-gradient(circle_at_30%_50%,transparent_40%,rgba(255,255,255,0.25)_41%,rgba(255,255,255,0.25)_55%,transparent_56%),radial-gradient(circle_at_70%_50%,transparent_40%,rgba(255,255,255,0.25)_41%,rgba(255,255,255,0.25)_55%,transparent_56%)]" />

                {/* Crease hairline scuffs across the box cover */}
                <div className="absolute top-12 left-0 w-24 h-[0.5px] bg-[#ded2b9]/15 rotate-[32deg] blur-[0.2px] pointer-events-none z-10 mix-blend-overlay" />
                <div className="absolute bottom-16 right-0 w-32 h-[0.8px] bg-[#ded2b9]/12 rotate-[-28deg] blur-[0.3px] pointer-events-none z-10 mix-blend-overlay" />

                {/* Distressed worn cardboard corners (revealing raw cardboard pulp under print) */}
                <div 
                    className="absolute top-0 left-0 w-3.5 h-3.5 bg-[#dfd7c2] opacity-[0.85] blur-[0.2px] mix-blend-overlay pointer-events-none rounded-tl-md"
                    style={{ clipPath: 'polygon(0% 0%, 100% 0%, 0% 100%)' }}
                />
                <div 
                    className="absolute top-0 right-0 w-3.5 h-3.5 bg-[#dfd7c2] opacity-[0.85] blur-[0.2px] mix-blend-overlay pointer-events-none rounded-tr-md"
                    style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%)' }}
                />
                
                {/* Frayed cardboard box wear lines along borders */}
                <div className="absolute inset-0 z-10 pointer-events-none border border-white/5 rounded-t-md shadow-[inset_0_0_12px_rgba(255,255,255,0.08),inset_0_0_2px_rgba(255,255,255,0.15)]" />
                <div className="absolute left-[0.5px] inset-y-0 w-[1px] bg-[#dfd7c2]/20 z-10 pointer-events-none opacity-40 blur-[0.2px] mix-blend-overlay" />
                <div className="absolute right-[0.5px] inset-y-0 w-[1px] bg-[#dfd7c2]/20 z-10 pointer-events-none opacity-40 blur-[0.2px] mix-blend-overlay" />

                {/* 3D Cardboard thickness bevel highlights */}
                <div className="absolute top-[1.5px] inset-x-[1.5px] h-[1px] bg-white/20 pointer-events-none z-10" />
                <div className="absolute left-[1.5px] inset-y-[1.5px] w-[1px] bg-white/12 pointer-events-none z-10" />
                <div className="absolute right-[1.5px] inset-y-[1.5px] w-[1.5px] bg-black/45 pointer-events-none z-10" />

                {/* Cardboard box mouth/opening bottom deep shadow */}
                <div className="absolute bottom-0 inset-x-0 h-3.5 bg-gradient-to-t from-[#050608] via-transparent to-transparent z-15 pointer-events-none" />

                {/* Semicircular finger pull slot at the bottom to insert cassette */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-3.5 rounded-t-full bg-[#050608] z-20 border-t border-white/5 shadow-inner opacity-75 pointer-events-none" />

                {/* Retro VHS Format Badge on the cover */}
                <div className="absolute top-3 right-3 z-20 select-none scale-[0.8] md:scale-95 origin-top-right mix-blend-screen opacity-85">
                    <div className="bg-black/90 border border-white/20 rounded px-1.5 py-0.5 flex flex-col items-center shadow-lg">
                        <span className="text-[8px] font-black tracking-[0.25em] text-white/95 leading-none italic font-sans">VHS</span>
                        <div className="w-full h-[0.5px] bg-white/40 my-[1.5px]" />
                        <span className="text-[4px] font-black tracking-widest text-zinc-400 leading-none">NTSC-M</span>
                    </div>
                </div>

                {/* Kame Video Club Neon Rental Sticker */}
                <div className="absolute top-3 left-3 z-20 select-none rotate-[-8deg] scale-[0.75] md:scale-90 origin-top-left drop-shadow-[1px_2px_3px_rgba(0,0,0,0.5)]">
                    <div className="bg-amber-400 text-black border border-amber-500 rounded-full w-8 h-8 flex flex-col items-center justify-center font-black text-[6px] tracking-tighter uppercase font-sans">
                        <span className="leading-none text-[4.5px] font-semibold text-zinc-800">KAME</span>
                        <span className="leading-none text-[7.5px] text-zinc-950 font-black">VIDEO</span>
                        <span className="leading-none text-[3.5px] text-zinc-800 tracking-widest">CLUB</span>
                    </div>
                </div>

                {/* Background image & gradient */}
                <div className="absolute inset-0 z-0 bg-zinc-900">
                    <div className="relative w-full h-full">
                        <DeferredImage 
                            src={item.posterUrl || ""} 
                            alt="" 
                            className={cn(
                                "w-full h-full object-cover transition-all duration-700 filter contrast-[1.03] saturate-[0.97]",
                                isSelected ? "brightness-100 scale-105" : "brightness-75 group-hover:brightness-90"
                            )}
                            showSkeleton={true}
                        />
                        <div 
                            className="absolute inset-0 z-[1] bg-gradient-to-t from-[#0d0f14] via-[#0d0f14]/20 to-transparent"
                            style={{ opacity: isSelected ? 0.95 : 0.55 }}
                        />
                    </div>
                </div>

                {/* Detail overlay (slides up when selected) */}
                <div 
                    className={cn(
                        "absolute left-0 right-0 bottom-0 pt-20 pb-6 px-6 transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) z-20 flex flex-col",
                        isSelected ? "translate-y-0" : "translate-y-[120%]"
                    )}
                    style={{ background: "linear-gradient(transparent 0%, rgba(8,10,15,0.99) 35%)" }}
                >
                    <h3 className="text-[20px] sm:text-[24px] font-black text-white mb-2 leading-[1.1] font-display tracking-tight">{item.title}</h3>
                    <div className="text-[11px] sm:text-[12px] text-white/50 flex items-center gap-2 mb-4 font-medium uppercase tracking-wider">
                        <span className="bg-white/10 px-2 py-0.5 rounded-md">{item.year || "2024"}</span>
                        <span className="w-[3px] h-[3px] rounded-full bg-white/20" />
                        <span className="bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-md border border-brand-orange/20">
                            {item.episodesCount ? `${item.episodesCount} EPS` : "?? EPS"}
                        </span>
                    </div>
                    {item.description && (
                        <p className="text-[12px] sm:text-[13px] leading-[1.7] text-white/70 line-clamp-3 sm:line-clamp-5 mb-6 font-medium">
                            {item.description.replace(/<[^>]*>?/gm, '')}
                        </p>
                    )}
                    
                    <div className="flex flex-col mb-6">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[9px] sm:text-[10px] font-black tracking-[0.15em] uppercase text-white/40">Progreso</span>
                            <span className="text-[11px] font-bold text-brand-orange tabular-nums">{Math.round(progress)}%</span>
                        </div>
                        <div className="relative h-[4px] bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-brand-orange to-[#ff9d5c] rounded-full"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={(e) => { e.stopPropagation(); onPlayClick(); }}
                        className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white rounded-xl text-[13px] sm:text-[14px] font-black tracking-widest uppercase py-4 transition-all flex items-center justify-center gap-3 shadow-[0_10px_25px_rgba(255,110,58,0.3)] active:scale-[0.97] hover:-translate-y-0.5"
                    >
                        <Play className="w-4 h-4 fill-current" />
                        Reproducir ahora
                    </button>
                </div>
            </motion.div>

            {/* Gap shadow between slot cover and cartridge */}
            <div className="h-[2.5px] w-full bg-[#050608] z-[12] relative shadow-inner shrink-0" />

            {/* Status Accent Laser Stripe */}
            <div className={cn("h-[4px] w-full shrink-0 relative z-[12] transition-all duration-300", statusAccentClass)} />

            {/* 2. Realistic Dark Plastic VHS Cartridge Body */}
            <motion.div 
                className="py-3.5 px-2.5 flex flex-col shrink-0 select-none relative bg-[#131418] border-t border-black overflow-hidden z-10"
                style={{
                    boxShadow: "inset 0 6px 14px rgba(0,0,0,0.95), 0 3px 6px rgba(0,0,0,0.85)"
                }}
                animate={{
                    y: isSelected ? 24 : hovered ? 12 : 0,
                }}
                transition={{ type: "spring", stiffness: 180, damping: 20 }}
            >
                {/* Matte Corrugated Plastic Texture Overlay */}
                <div 
                    className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.7)_1px,transparent_1px)] bg-[length:3px_3px] mix-blend-screen" 
                />
                <div 
                    className="absolute inset-0 pointer-events-none opacity-[0.08]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='plasticNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23plasticNoise)'/%3E%3C/svg%3E")`
                    }}
                />
                
                {/* Horizontal plastic structural molded lines */}
                <div className="absolute inset-x-0 top-3 h-[1px] bg-black/60 shadow-[0_1px_0_rgba(255,255,255,0.015)] pointer-events-none" />
                <div className="absolute inset-x-0 bottom-4 h-[1px] bg-black/60 shadow-[0_1px_0_rgba(255,255,255,0.015)] pointer-events-none" />

                {/* Write-protect notch on left edge */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#09090b] border-r border-y border-zinc-800 rounded-r shadow-[inset_2px_0_4px_rgba(0,0,0,0.9)] z-10" />

                {/* Corner screws with metallic screw slots and threads (Skeuomorphic Detail) */}
                <div className="absolute left-2.5 top-1.5 w-2 h-2 rounded-full bg-[#08090b] shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.95)] border border-zinc-800 flex items-center justify-center z-10">
                    <div className="w-[3px] h-[3px] rounded-full bg-zinc-400 flex items-center justify-center relative shadow-[inset_0.2px_0.2px_0.5px_black]">
                        <div className="w-[2px] h-[0.6px] bg-zinc-700 rotate-45" />
                        <div className="w-[2px] h-[0.6px] bg-zinc-700 -rotate-45" />
                    </div>
                </div>
                <div className="absolute right-2.5 top-1.5 w-2 h-2 rounded-full bg-[#08090b] shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.95)] border border-zinc-800 flex items-center justify-center z-10">
                    <div className="w-[3px] h-[3px] rounded-full bg-zinc-400 flex items-center justify-center relative shadow-[inset_0.2px_0.2px_0.5px_black]">
                        <div className="w-[2px] h-[0.6px] bg-zinc-700 rotate-[20deg]" />
                        <div className="w-[2px] h-[0.6px] bg-zinc-700 rotate-[-70deg]" />
                    </div>
                </div>

                {/* Molded plastic brand text details */}
                <div className="absolute left-8 top-1.5 text-[4px] font-black uppercase text-zinc-700 tracking-[0.2em] select-none shadow-[0_1px_0_rgba(255,255,255,0.01)] z-10">
                    ◀ INSERT TAPE
                </div>
                <div className="absolute right-8 top-1.5 text-[4px] font-black uppercase text-zinc-700 tracking-[0.2em] select-none shadow-[0_1px_0_rgba(255,255,255,0.01)] z-10">
                    MADE IN JAPAN
                </div>

                {/* Vintage Shop Price Tag Sticker with Peeled Corner */}
                {retro.hasRentalStamp && (
                    <div 
                        className="absolute top-[8px] left-[76px] px-2 py-0.5 rounded-sm bg-[#ffd700] text-zinc-950 border border-amber-600/40 font-sans font-black text-[5.5px] uppercase select-none z-20 shadow-[1px_2.5px_4px_rgba(0,0,0,0.55)] rotate-[3.5deg] scale-[0.85] tracking-tighter"
                        style={{
                            backgroundImage: 'linear-gradient(135deg, #ffe033 0%, #ffd700 100%)',
                            boxShadow: '1px 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
                        }}
                    >
                        {/* Peeling corner of price sticker */}
                        <div className="absolute bottom-0 right-0 w-[4px] h-[4px] bg-[#131418]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} />
                        <div className="absolute bottom-0 right-0 w-[4px] h-[4px] bg-[#ffe033] shadow-[-0.5px_-0.5px_1px_rgba(0,0,0,0.3)]" style={{ clipPath: 'polygon(0 0, 0 100%, 100% 100%)' }} />
                        
                        ALQUILER $2.00
                    </div>
                )}

                {/* Double Spool Window Compartment */}
                <div className="w-full h-9.5 bg-[#090a0d] rounded border border-zinc-900 shadow-[inset_0_3.5px_7px_rgba(0,0,0,0.98)] relative flex items-center justify-around overflow-hidden px-2 mt-2.5 mb-1.5 z-10">
                    
                    {/* Glass windowpane dynamic glare reflection */}
                    <div 
                        className="absolute inset-0 pointer-events-none z-15 mix-blend-screen opacity-65"
                        style={{
                            background: hovered 
                                ? `linear-gradient(120deg, transparent 15%, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.22) 25%, rgba(255,255,255,0.05) 30%, transparent 40%)`
                                : `linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.02) 35%, rgba(255,255,255,0.08) 38%, rgba(255,255,255,0.02) 41%, transparent 46%)`,
                            backgroundSize: '200% 100%',
                            backgroundPosition: hovered ? `${(cursorPos.x / 1.5) - 30}% 0` : '0% 0',
                            transition: 'background-position 0.12s ease-out'
                        }}
                    />

                    {/* Dynamic warm backing glow inside window pane (glowing diagnostic LED effect) */}
                    <div 
                        className={cn(
                            "absolute inset-0 z-10 pointer-events-none transition-opacity duration-500 bg-[radial-gradient(circle_at_center,rgba(251,146,60,0.18)_0%,transparent_75%)]",
                            (hovered || isSelected) ? "opacity-100 animate-[window-pulse_3s_ease-in-out_infinite]" : "opacity-0"
                        )}
                    />

                    {/* Micro dust/scratches on window */}
                    <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[length:40px_40px] opacity-[0.03] z-10 pointer-events-none" />

                    {/* Diagnostic alignment grid overlay in the acrylic window */}
                    <div className="absolute inset-x-2 inset-y-1.5 border-x border-zinc-800/10 pointer-events-none z-12 opacity-[0.4]" />
                    <div className="absolute inset-x-1.5 inset-y-2 border-y border-zinc-800/10 pointer-events-none z-12 opacity-[0.4]" />

                    {/* Left metal guide pin */}
                    <div className="absolute left-1 bottom-1 w-1.5 h-1.5 rounded-full bg-gradient-to-br from-zinc-400 to-zinc-700 border border-zinc-800 shadow-inner z-12" />
                    {/* Right metal guide pin */}
                    <div className="absolute right-1 bottom-1 w-1.5 h-1.5 rounded-full bg-gradient-to-br from-zinc-400 to-zinc-700 border border-zinc-800 shadow-inner z-12" />

                    {/* Magnetic Tape Ribbon Bridge running behind spools in window */}
                    <div className="absolute bottom-[9px] inset-x-9 h-[3px] bg-[#3a2211] border-y border-[#20140a] z-11 opacity-90 shadow-md">
                        <div className="absolute inset-0 bg-gradient-to-r from-[#20140a] via-transparent to-[#20140a]" />
                    </div>

                    {/* Left Spool */}
                    <div className="w-8 h-8 rounded-full bg-[#111215] border border-zinc-900 shadow-[0_1.5px_3px_rgba(0,0,0,0.8)] flex items-center justify-center relative overflow-hidden shrink-0">
                        {/* Brown tape spool representing wound magnetic tape */}
                        <div 
                            className="rounded-full bg-zinc-950 flex items-center justify-center transition-all duration-500 relative" 
                            style={{ 
                                width: '25px', 
                                height: '25px', 
                                border: `${retro.leftSpoolWidth}px solid #36210f`,
                                boxShadow: '0 0 0 1px #1a1007, inset 0 0 4px rgba(0,0,0,0.9)'
                            }}
                        >
                            {/* Fine concentric winding lines overlay to simulate wraps */}
                            <div className="absolute inset-0 rounded-full opacity-[0.25] mix-blend-overlay bg-[repeating-radial-gradient(circle,#000,#000_0.4px,transparent_0.4px,transparent_0.8px)]" />

                            {/* White plastic hub in the center with detailed outer cogs */}
                            <div 
                                className={cn(
                                    "w-4 h-4 rounded-full bg-[#fcfdfd] border border-zinc-300 shadow-[0_1.5px_2px_rgba(0,0,0,0.6)] flex items-center justify-center relative shrink-0",
                                    (hovered || isSelected) ? "animate-[drive-spindle-spin_16s_linear_infinite]" : "rotate-[25deg]"
                                )}
                            >
                                <div className="absolute inset-[1.5px] rounded-full border border-zinc-200" />
                                {Array.from({ length: 9 }).map((_, i) => (
                                    <div 
                                        key={i} 
                                        className="absolute w-[0.8px] h-[3.8px] bg-zinc-300 rounded-sm shadow-[0.2px_0.2px_0.2px_rgba(0,0,0,0.15)]"
                                        style={{ transform: `rotate(${i * 40}deg) translateY(-2.2px)` }}
                                    />
                                ))}
                                {/* Spokes inside the hub */}
                                <div className="absolute w-[1.8px] h-[8px] bg-zinc-400 rounded-sm" />
                                <div className="absolute w-[1.8px] h-[8px] bg-zinc-400 rounded-sm rotate-120" />
                                <div className="absolute w-[1.8px] h-[8px] bg-zinc-400 rounded-sm -rotate-120" />
                                {/* Center drive spindle hole */}
                                <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 shadow-inner z-10 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Center plastic bridge with vintage tape logo */}
                    <div className="text-[5px] font-black tracking-widest text-zinc-650 uppercase font-mono z-12 bg-zinc-950/90 px-1 py-0.5 rounded border border-zinc-900 select-none">
                        VHS
                    </div>

                    {/* Right Spool */}
                    <div className="w-8 h-8 rounded-full bg-[#111215] border border-zinc-900 shadow-[0_1.5px_3px_rgba(0,0,0,0.8)] flex items-center justify-center relative overflow-hidden shrink-0">
                        {/* Brown tape spool representing wound magnetic tape */}
                        <div 
                            className="rounded-full bg-zinc-950 flex items-center justify-center transition-all duration-500 relative" 
                            style={{ 
                                width: '25px', 
                                height: '25px', 
                                border: `${retro.rightSpoolWidth}px solid #36210f`,
                                boxShadow: '0 0 0 1px #1a1007, inset 0 0 4px rgba(0,0,0,0.9)'
                            }}
                        >
                            {/* Fine concentric winding lines overlay */}
                            <div className="absolute inset-0 rounded-full opacity-[0.25] mix-blend-overlay bg-[repeating-radial-gradient(circle,#000,#000_0.4px,transparent_0.4px,transparent_0.8px)]" />

                            {/* White plastic hub in the center with detailed outer cogs */}
                            <div 
                                className={cn(
                                    "w-4 h-4 rounded-full bg-[#fcfdfd] border border-zinc-300 shadow-[0_1.5px_2px_rgba(0,0,0,0.6)] flex items-center justify-center relative shrink-0",
                                    (hovered || isSelected) ? "animate-[drive-spindle-spin_16s_linear_infinite]" : "rotate-[70deg]"
                                )}
                            >
                                <div className="absolute inset-[1.5px] rounded-full border border-zinc-200" />
                                {Array.from({ length: 9 }).map((_, i) => (
                                    <div 
                                        key={i} 
                                        className="absolute w-[0.8px] h-[3.8px] bg-zinc-300 rounded-sm shadow-[0.2px_0.2px_0.2px_rgba(0,0,0,0.15)]"
                                        style={{ transform: `rotate(${i * 40}deg) translateY(-2.2px)` }}
                                    />
                                ))}
                                {/* Spokes inside the hub */}
                                <div className="absolute w-[1.8px] h-[8px] bg-zinc-400 rounded-sm" />
                                <div className="absolute w-[1.8px] h-[8px] bg-zinc-400 rounded-sm rotate-120" />
                                <div className="absolute w-[1.8px] h-[8px] bg-zinc-400 rounded-sm -rotate-120" />
                                {/* Center drive spindle hole */}
                                <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 shadow-inner z-10 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Physical Recessed Border Area for Sticker Label */}
                <div 
                    className="rounded bg-zinc-950 p-[1.5px] shadow-[inset_1.5px_2px_4px_rgba(0,0,0,0.9),1px_1px_0px_rgba(255,255,255,0.03)] mt-1.5 shrink-0"
                    style={{ transform: `rotate(${retro.rotationAngle}deg)` }}
                >
                    {/* Recessed Sticker Label */}
                    <div 
                        className="p-2 rounded-[2px] text-zinc-900 border-l-[6px] shadow-[1.5px_2.5px_4px_rgba(0,0,0,0.45)] flex flex-col gap-1 relative overflow-hidden group/label min-h-[58px]"
                        style={{ 
                            borderLeftColor: baseColor,
                            backgroundImage: brandStyle.bg,
                            backgroundSize: brandStyle.bgSize,
                            backgroundColor: brandStyle.paperColor,
                        }}
                    >
                        {/* Foxing aging spots & vintage damp moisture stains */}
                        <div 
                            className="absolute inset-0 pointer-events-none opacity-[0.55] mix-blend-multiply z-[1]" 
                            style={{
                                backgroundImage: `
                                    radial-gradient(circle at 18% 30%, #caab77 0%, transparent 12%),
                                    radial-gradient(circle at 82% 70%, #c0a068 0%, transparent 14%),
                                    radial-gradient(circle at 50% 80%, #b5955a 0%, transparent 8%),
                                    radial-gradient(circle at 90% 15%, #b5955a 0%, transparent 10%)
                                `,
                                filter: 'blur-[2px]'
                            }}
                        />

                        {/* Paper Fiber Fine Texture overlay */}
                        <div 
                            className="absolute inset-0 pointer-events-none opacity-[0.06] z-[1] mix-blend-overlay"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='labelNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.08' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23labelNoise)'/%3E%3C/svg%3E")`
                            }}
                        />

                        {/* Sticker Header Row */}
                        <div className="flex items-center justify-between relative z-10 pl-3">
                            <span className="text-[7.5px] font-black tracking-widest font-sans text-zinc-700 select-none flex items-center gap-1">
                                {retro.brand} <span className="text-[5.5px] font-semibold text-zinc-400 bg-zinc-800 px-1 py-0.2 rounded">{retro.tapeModel}</span>
                            </span>
                            
                            <div className="flex gap-1 text-[5.5px] font-mono text-zinc-500 scale-90 origin-right select-none">
                                <span className={cn(retro.speed === "SP" ? "text-zinc-950 font-black" : "opacity-50 font-normal")}>
                                    {retro.speed === "SP" ? "☑" : "☐"} SP
                                </span>
                                <span className={cn(retro.speed === "LP" ? "text-zinc-950 font-black" : "opacity-50 font-normal")}>
                                    {retro.speed === "LP" ? "☑" : "☐"} LP
                                </span>
                                <span className={cn(retro.speed === "EP" ? "text-zinc-950 font-black" : "opacity-50 font-normal")}>
                                    {retro.speed === "EP" ? "☑" : "☐"} EP
                                </span>
                            </div>
                        </div>
                        
                        {/* Retro red-and-blue thin striping dividing line */}
                        <div className="h-[2px] w-full flex relative z-10 rounded-full overflow-hidden opacity-30 my-0.5">
                            <div className="flex-1 bg-red-500" />
                            <div className="flex-1 bg-blue-500" />
                            <div className="flex-1 bg-amber-500" />
                        </div>
                        
                        {/* Sticker Content Row - Handwritten Title */}
                        <div className="flex items-center justify-between gap-1.5 relative z-10 pl-3 min-h-[22px]">
                            <span 
                                className="text-[12px] sm:text-[14px] font-black tracking-tight line-clamp-1 italic rotate-[-0.8deg] flex-1 filter opacity-95"
                                style={{
                                    color: retro.handwrittenColor,
                                    fontFamily: retro.handwrittenFont,
                                    textShadow: `0.3px 0.3px 1.5px rgba(0,0,0,0.12), 0px 0px 1px ${retro.handwrittenColor}80, 0px 0px 2px ${retro.handwrittenColor}30`
                                }}
                            >
                                {item.title}
                            </span>
                            
                            <span className="text-[5px] font-black uppercase text-red-650/80 border-2 border-red-650/40 px-1 py-0.2 rounded font-mono select-none tracking-widest rotate-[-4deg] shrink-0 scale-90 bg-white/20 backdrop-blur-[0.5px]">
                                ¡REBOBINADO!
                            </span>
                        </div>

                        {/* 3D Folded/Peeled Dog-Ear sticker corner (shows plastic cassette underneath) */}
                        <div className="absolute top-0 right-0 w-[16px] h-[16px] pointer-events-none z-20">
                            {/* Exposed dark plastic cartridge corner */}
                            <div className="absolute top-0 right-0 w-[16px] h-[16px] bg-[#111215] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.9)]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} />
                            {/* Folded paper triangle with shadow */}
                            <div 
                                className="absolute top-0 right-0 w-[16px] h-[16px] bg-gradient-to-tr from-[#dfd7c2] via-[#e8e0cc] to-[#faf9f6] shadow-[-1.5px_1.5px_2px_rgba(0,0,0,0.5)] border-l border-b border-black/10" 
                                style={{ 
                                    clipPath: 'polygon(0 0, 0 100%, 100% 100%)',
                                    transformOrigin: 'bottom left'
                                }} 
                            />
                        </div>
                    </div>
                </div>

                {/* Overlapping Video Rental Barcode Label */}
                <div 
                    className="absolute bottom-1 right-2.5 px-1.5 py-0.5 rounded bg-[#fdfdfc] text-black border border-zinc-400 shadow-[1px_2px_4px_rgba(0,0,0,0.45)] z-20 flex flex-col items-center gap-0.2 rotate-[1.5deg] scale-[0.72] origin-bottom-right"
                    style={{ 
                        fontFamily: 'monospace',
                        backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(139, 90, 43, 0.08) 0%, transparent 60%)' 
                    }}
                >
                    <span className="text-[4px] font-black tracking-widest leading-none text-zinc-500 scale-90 uppercase select-none">KAME-VIDEO</span>
                    <span className="text-[10px] font-normal leading-none tracking-tighter select-none font-mono text-zinc-950">|||| || |||||</span>
                    <span className="text-[4px] font-bold leading-none scale-75 text-zinc-700 font-mono">*{retro.code}*</span>
                </div>

                {/* Iconic Neon "POR FAVOR REBOBINAR" sticker */}
                {retro.hasBeKindSticker && (
                    <div 
                        className="absolute bottom-2 left-3 px-2 py-0.5 rounded bg-[#ff007f] text-white border border-[#ff66b2] shadow-[1px_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.3)] z-20 flex items-center justify-center gap-0.5 rotate-[-7deg] scale-[0.72] origin-bottom-left select-none font-mono font-black uppercase text-[4.5px] tracking-[0.1em] hover:scale-[0.8] hover:-rotate-12 transition-transform"
                        style={{ textShadow: '0.5px 0.5px 0px rgba(0,0,0,0.3)' }}
                    >
                        <span className="inline-block text-[5px]">📼</span>
                        <span>FAVOR REBOBINAR</span>
                    </div>
                )}

                {/* Retro Inventory Dot Sticker */}
                {retro.hasColoredDot && (
                    <div 
                        className="absolute top-[54px] right-4.5 z-20 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[5px] font-black text-black shadow-[1px_1px_3px_rgba(0,0,0,0.4)] border border-black/15 select-none font-mono hover:scale-105 transition-transform"
                        style={{ 
                            backgroundColor: retro.coloredDotColor, 
                            transform: `rotate(${(typeof item.id === 'number' ? item.id : 0) % 20 - 10}deg) scale(0.8)` 
                        }}
                    >
                        {retro.coloredDotText}
                    </div>
                )}
            </motion.div>
        </div>
    )
})
VhsTapeCard.displayName = "VhsTapeCard"

export const VhsCollection = memo(({ 
    items, 
    onItemClick, 
    className,
    onHoverItem,
    activeColor,
    selectedId: controlledSelectedId,
    onSelectId
}: VhsCollectionProps) => {
    const [localSelectedId, setLocalSelectedId] = useState<string | number | null>(null)
    const isControlled = controlledSelectedId !== undefined
    const selectedId = isControlled ? controlledSelectedId : localSelectedId
    const setSelectedId = (id: string | number | null) => {
        if (onSelectId) onSelectId(id)
        if (!isControlled) setLocalSelectedId(id)
    }

    // Local state to track hover item within VhsCollection for dynamic backdrop rendering
    const [hoveredItem, setHoveredItem] = useState<VhsCollectionItem | null>(null)

    // Lookup selected item details
    const selectedItem = useMemo(() => {
        return items.find(item => item.id === selectedId) || null
    }, [items, selectedId])

    // Dynamic blur backdrop image URL
    const activePosterUrl = hoveredItem?.posterUrl || selectedItem?.posterUrl

    // CRT Screen flash effect on tape selection
    const [glitchActive, setGlitchActive] = useState(false)
    useEffect(() => {
        if (selectedId) {
            setGlitchActive(true)
            const timer = setTimeout(() => setGlitchActive(false), 280)
            return () => clearTimeout(timer)
        }
    }, [selectedId])

    return (
        <div 
            className={cn("w-full h-full flex flex-col overflow-hidden min-h-0 relative", className)}
            style={{
                backgroundColor: "#100804", // Deep brown walnut wood shadow base
                backgroundImage: `
                    /* Vertical plank slats and recessed board shadows */
                    repeating-linear-gradient(90deg, rgba(0,0,0,0.45) 0px, rgba(0,0,0,0.45) 3px, transparent 3px, transparent 150px, rgba(0,0,0,0.65) 150px, rgba(0,0,0,0.65) 153px),
                    /* Wooden grain fine organic fiber lines */
                    repeating-linear-gradient(0deg, rgba(255,255,255,0.005) 0px, rgba(255,255,255,0.005) 1px, transparent 1px, transparent 4px),
                    repeating-linear-gradient(90deg, rgba(255,255,255,0.005) 0px, rgba(255,255,255,0.005) 2px, transparent 2px, transparent 5px),
                    /* Aged wood lighting vignette highlights */
                    radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 80%),
                    /* Base vertical plank gradient shades */
                    linear-gradient(to right, #0e0704, #180c06 20%, #1f1109 50%, #180c06 80%, #0e0704)
                `
            }}
        >
            {/* CRT Phosphor Scanline & Shadow-mask Overlay (Atmospheric vintage flicker) */}
            <div className="absolute inset-0 pointer-events-none z-30 opacity-[0.038] mix-blend-overlay bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.22)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] animate-[crt-flicker_0.15s_infinite]" />

            {/* Interactive CRT Static Glitch overlay upon selecting a new cassette */}
            {glitchActive && (
                <div className="absolute inset-0 pointer-events-none z-50 bg-black/35 mix-blend-screen opacity-90 animate-[crt-glitch_0.22s_steps(2)_infinite]"
                     style={{
                         backgroundImage: `
                             radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.45) 100%),
                             repeating-linear-gradient(0deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 4px, transparent 4px, transparent 8px)
                         `
                     }}
                />
            )}

            {/* Dynamic Blurred Poster Backdrop */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 transition-all duration-1000">
                <AnimatePresence mode="wait">
                    {activePosterUrl && (
                        <motion.div 
                            key={activePosterUrl}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.15 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8 }}
                            className="absolute inset-0 bg-cover bg-center filter blur-[85px] saturate-150 scale-110"
                            style={{ 
                                backgroundImage: `url(${activePosterUrl})`,
                            }}
                        />
                    )}
                </AnimatePresence>
                {/* Dark blend overlay to ensure proper contrast of wood grains & tapes */}
                <div className="absolute inset-0 bg-black/50 mix-blend-multiply" />
            </div>

            {/* LED Ambient Backing Glow (diffused backing light) */}
            <div 
                className="absolute inset-x-8 top-12 bottom-16 filter blur-[120px] pointer-events-none transition-all duration-1000 opacity-25 z-0"
                style={{ backgroundColor: activeColor || "#ff6b00" }}
            />

            {/* Top LED Cone of Light Casting Downward onto back panel */}
            <div 
                className="absolute top-4 inset-x-0 h-[480px] pointer-events-none z-0 opacity-45 blur-3xl transition-all duration-1000"
                style={{
                    background: `radial-gradient(ellipse 35% 65% at 50% 0%, ${activeColor || "#ff6b00"}35 0%, ${activeColor || "#ff6b00"}06 65%, transparent 100%)`
                }}
            />

            {/* Cabinet Wood Moldings (Left & Right margins in polished Walnut trim) */}
            <div 
                className="absolute inset-y-0 left-0 w-3 z-20 shadow-[8px_0_20px_rgba(0,0,0,0.85)] border-r border-white/5" 
                style={{
                    background: "linear-gradient(to right, #2d160b, #1d0e06 80%, #110803 100%)"
                }}
            />
            <div 
                className="absolute inset-y-0 right-0 w-3 z-20 shadow-[-8px_0_20px_rgba(0,0,0,0.85)] border-l border-white/5" 
                style={{
                    background: "linear-gradient(to left, #2d160b, #1d0e06 80%, #110803 100%)"
                }}
            />

            {/* Premium Top Lip Housing and LED Lightbar casing */}
            <div className="absolute top-0 inset-x-0 h-4 bg-[#0a0604] border-b border-black/80 z-25 shadow-[0_4px_12px_rgba(0,0,0,0.95)]">
                <div className="absolute top-[2px] inset-x-12 h-1 bg-[#1a110d] rounded-full border border-white/5 overflow-hidden flex items-center justify-around">
                    <div className="w-1/4 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <div className="w-1/4 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>
            </div>

            {/* Top ambient color-casting LED strip glow */}
            <div 
                className="absolute top-4 inset-x-0 h-32 bg-gradient-to-b from-current to-transparent pointer-events-none z-20 opacity-30 filter blur-xl transition-all duration-1000"
                style={{ color: activeColor || "#ff6b00" }}
            />

            {/* Shelf Glass Door Sheen Overlay */}
            <div className="absolute inset-0 pointer-events-none z-40 bg-gradient-to-tr from-transparent via-white/[0.015] to-transparent" />

            {/* Shelf Slot Rails (grooves in backing behind tapes) */}
            <div 
                className="absolute inset-x-3 bottom-[26px] h-[36px] opacity-75 pointer-events-none z-0 border-t border-black/85"
                style={{
                    background: "repeating-linear-gradient(90deg, #060709 0px, #060709 136px, #18191f 136px, #18191f 140px, #040506 140px, #040506 142px)",
                    boxShadow: "inset 0 4px 6px rgba(0,0,0,0.95), 0 2px 2px rgba(255,255,255,0.02)"
                }}
            />

            {/* Vhs Row with Top/Bottom padding to prevent slide-up clip */}
            <div className="flex-1 w-full flex flex-row items-stretch min-h-0 overflow-x-auto no-scrollbar pt-16 pb-6 px-7 gap-1.5 relative z-10">
                {items.map((item) => (
                    <VhsTapeCard
                        key={item.id}
                        item={item}
                        isSelected={selectedId === item.id}
                        onClick={() => {
                            if (selectedId === item.id) {
                                onItemClick(item)
                            } else {
                                setSelectedId(item.id)
                            }
                        }}
                        onPlayClick={() => onItemClick(item)}
                        onMouseEnter={() => {
                            setHoveredItem(item)
                            onHoverItem?.(item)
                        }}
                        onMouseLeave={() => {
                            setHoveredItem(null)
                            onHoverItem?.(null)
                        }}
                    />
                ))}
            </div>
            
            {/* High-End Collector's Shelf Floor with Metallic Bronze Bevel and LED Reflections */}
            <div className="h-[28px] shrink-0 bg-[#2b170c] border-t-[3px] border-[#422413] relative z-30 shadow-[0_-8px_24px_rgba(0,0,0,0.85)]"
                 style={{
                     backgroundImage: 'linear-gradient(to bottom, #201109, #120905 50%, #080402 100%)'
                 }}
            >
                {/* Metallic shelf gold/bronze front bevel strip */}
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-amber-600/30 via-amber-400/70 to-amber-600/30 border-b border-black/40" />
                
                {/* Dynamic LED Lightbar Reflection */}
                <div 
                    className="absolute inset-x-0 top-0 h-[2.5px] blur-[1px] transition-all duration-700" 
                    style={{ backgroundColor: activeColor || "#ff6b00", opacity: 0.95 }}
                />
                
                <div className="h-full flex items-center justify-between px-6">
                    <div className="flex gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/50 shadow-inner" />
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/50 shadow-inner" />
                    </div>
                    
                    <span className="text-[8px] font-black tracking-[0.25em] text-white/50 uppercase font-sans flex items-center gap-2 select-none">
                        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px_currentColor]" style={{ color: activeColor || "#ff6b00", backgroundColor: activeColor || "#ff6b00" }} />
                        VITRINA KAMEHOUSE VHS
                    </span>
                    
                    <div className="flex gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/50 shadow-inner" />
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/50 shadow-inner" />
                    </div>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Nanum+Pen+Script&family=Shadows+Into+Light&display=swap');
                
                @keyframes drive-spindle-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                @keyframes tape-sheen {
                    0% { background-position: -100px 0; }
                    100% { background-position: 200px 0; }
                }

                @keyframes window-pulse {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 0.95; }
                }

                @keyframes crt-flicker {
                    0% { opacity: 0.033; }
                    50% { opacity: 0.043; }
                    100% { opacity: 0.038; }
                }

                @keyframes crt-glitch {
                    0% { transform: translate(1px, -1px) skewX(1deg); filter: hue-rotate(45deg) saturate(1.8); }
                    50% { transform: translate(-1px, 1.5px) skewX(-1deg); filter: hue-rotate(135deg) saturate(2.4); }
                    100% { transform: translate(0.5px, 0.5px) skewX(0deg); }
                }
            `}} />
        </div>
    )
})
VhsCollection.displayName = "VhsCollection"
