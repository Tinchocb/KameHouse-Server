import { useState, memo, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VhsTapeItem {
    id: string | number
    title: string
    subtitle?: string
    description?: string
    posterUrl?: string
    bannerUrl?: string
    episodesCount?: number
    watchedCount?: number
    genres?: string[]
    year?: string | number
    status?: "Completado" | "En progreso" | "Sin comenzar"
    isNew?: boolean
    color?: string
}

interface VhsShelfAccordionProps {
    items: VhsTapeItem[]
    onItemClick: (item: VhsTapeItem) => void
    selectedId: string | number | null
    onSelectId: (id: string | number | null) => void
    onHoverItem?: (item: VhsTapeItem | null) => void
    activeColor?: string
    className?: string
}

// ─── Constants & Styles ───────────────────────────────────────────────────────

const stringToColor = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const h = Math.abs(hash % 360)
    return `hsl(${h}, 65%, 45%)`
}

const getSeriesColor = (title: string) => {
    const t = title.toLowerCase()
    if (t.includes('super')) return '#1a4a8a' // Dark Blue
    if (t.includes('kai')) return '#1a5c2e' // Green
    if (t.includes('gt')) return '#2980b9' // Light Blue
    if (t.includes('daima')) return '#0e6655' // Emerald
    if (t.includes('dragon ball z') || t === 'dbz') return '#b51f1f' // Red
    if (t.includes('dragon ball')) return '#d96c14' // Classic Orange
    return stringToColor(title)
}

// ─── Single Horizontal Flat VHS Tape Ribbon Component ──────────────────────────

const VhsFlatTape = memo(({
    item,
    isSelected,
    onClick,
    onMouseEnter,
    onMouseLeave,
    index,
    totalItems
}: {
    item: VhsTapeItem
    isSelected: boolean
    onClick: () => void
    onMouseEnter: () => void
    onMouseLeave: () => void
    index: number
    totalItems: number
}) => {
    const baseColor = item.color || getSeriesColor(item.title)

    // Dynamic 3D interactive physics tilt state
    const [tilt, setTilt] = useState({ x: 0, y: 0 })
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
    const [hovered, setHovered] = useState(false)
    const cardRef = useRef<HTMLDivElement>(null)

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return
        const rect = cardRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        setCursorPos({ x, y })
        
        // Calculate elegant 3D tilt
        const normalizedX = (x / rect.width) * 2 - 1
        const normalizedY = (y / rect.height) * 2 - 1
        setTilt({
            x: -normalizedY * 6, // Rotate X (tilt forward/backward)
            y: normalizedX * 5,  // Rotate Y (turn left/right)
        })
    }

    const handleMouseEnterLocal = () => {
        setHovered(true)
        onMouseEnter()
    }

    const handleMouseLeaveLocal = () => {
        setHovered(false)
        setTilt({ x: 0, y: 0 })
        onMouseLeave()
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
        
        // Spool wrap widths based on watched ratio
        const total = item.episodesCount || 1
        const watched = item.watchedCount || 0
        const progressRatio = total > 0 ? watched / total : 0
        
        // Left spool empties as we watch; right spool fills up.
        // Spool diameter ranges from 2px to 10px of border thickness.
        const leftSpoolWidth = 2.5 + (1 - progressRatio) * 7.5
        const rightSpoolWidth = 2.5 + progressRatio * 7.5
        
        let hasBeKindSticker = idNum % 3 === 0
        let hasColoredDot = idNum % 2 === 0
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
        
        const rotationAngle = idNum % 2 === 0 ? -0.5 : 0.4

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
            coloredDotColor,
            coloredDotText
        }
    }, [item.title, item.id, item.episodesCount, item.watchedCount])

    const brandStyle = useMemo(() => {
        switch (retro.brand) {
            case "TDK":
                return {
                    bg: `
                        linear-gradient(to right, #ef4444 0px, #ef4444 3px, #f97316 3px, #f97316 6px, #f59e0b 6px, #f59e0b 9px, transparent 9px),
                        linear-gradient(to bottom, transparent 16px, rgba(239, 68, 68, 0.12) 16px, rgba(239, 68, 68, 0.12) 17px, transparent 17px),
                        linear-gradient(to right, transparent 10px, rgba(59, 130, 246, 0.06) 10px, rgba(59, 130, 246, 0.06) 11px, transparent 11px)
                    `,
                    bgSize: "100% 100%, 100% 100%, 11px 100%",
                    paperColor: "#FAF8EE", // Yellowed aged paper
                }
            case "MAXELL":
                return {
                    bg: `
                        linear-gradient(to right, #111827 0px, #111827 8px, #b91c1c 8px, #b91c1c 11px, transparent 11px),
                        linear-gradient(to right, transparent 12px, rgba(17, 24, 39, 0.03) 12px, rgba(17, 24, 39, 0.03) 13px, transparent 13px)
                    `,
                    bgSize: "100% 100%, 14px 100%",
                    paperColor: "#FFFDF6", // Cream
                }
            case "SONY":
                return {
                    bg: `
                        linear-gradient(45deg, #1f2937 0px, #1f2937 12px, #dc2626 12px, #dc2626 15px, transparent 15px),
                        linear-gradient(to bottom, transparent 20px, rgba(220, 38, 38, 0.1) 20px, rgba(220, 38, 38, 0.1) 21px, transparent 21px)
                    `,
                    bgSize: "100% 100%, 100% 100%",
                    paperColor: "#F4F3ED", // Vintage grey-white
                }
            case "BASF":
                return {
                    bg: `
                        linear-gradient(to right, #1e3a8a 0px, #1e3a8a 4px, #3b82f6 4px, #3b82f6 7px, transparent 7px)
                    `,
                    bgSize: "100% 100%",
                    paperColor: "#EBF8EF", // Soft green-white
                }
            case "JVC":
                return {
                    bg: `
                        linear-gradient(to right, #06b6d4 0px, #06b6d4 3px, #ec4899 3px, #ec4899 6px, #eab308 6px, #eab308 9px, transparent 9px),
                        linear-gradient(to right, transparent 11px, rgba(17, 24, 39, 0.04) 11px, rgba(17, 24, 39, 0.04) 12px, transparent 12px)
                    `,
                    bgSize: "100% 100%, 12px 100%",
                    paperColor: "#FFFDF0", // Golden warm
                }
            default:
                return {
                    bg: `
                        linear-gradient(to bottom, transparent 16px, rgba(239, 68, 68, 0.15) 16px, rgba(239, 68, 68, 0.15) 17px, transparent 17px),
                        linear-gradient(to right, transparent 9px, rgba(59, 130, 246, 0.08) 9px, rgba(59, 130, 246, 0.08) 10px, transparent 10px)
                    `,
                    bgSize: "100% 100%, 10px 100%",
                    paperColor: "#FAF8F0",
                }
        }
    }, [retro.brand])

    return (
        <motion.div 
            ref={cardRef}
            onClick={onClick}
            onMouseEnter={handleMouseEnterLocal}
            onMouseLeave={handleMouseLeaveLocal}
            onMouseMove={handleMouseMove}
            className={cn(
                "w-full h-[58px] sm:h-[66px] flex flex-row items-center bg-[#131418] rounded-xl border border-zinc-800/85 relative cursor-pointer select-none group shadow-[inset_0_2px_4px_rgba(255,255,255,0.05),0_6px_14px_rgba(0,0,0,0.6)] overflow-hidden shrink-0",
                isSelected && "border-brand-orange shadow-[0_0_20px_rgba(255,107,0,0.4)]"
            )}
            style={{
                transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateX(${isSelected ? '24px' : hovered ? '14px' : '0px'}) scale(${hovered && !isSelected ? 1.015 : 1})`,
                borderColor: isSelected ? baseColor : hovered ? `${baseColor}60` : "rgba(63,63,70,0.4)",
                boxShadow: isSelected 
                    ? `0 12px 25px -8px rgba(0,0,0,0.85), 0 0 25px ${baseColor}50, inset 0 0 2px rgba(255,255,255,0.1)` 
                    : hovered 
                        ? `0 8px 18px -6px rgba(0,0,0,0.7), 0 0 15px ${baseColor}25, inset 0 0 1px rgba(255,255,255,0.05)`
                        : "inset 0 1.5px 2px rgba(255,255,255,0.02), 0 4px 8px rgba(0,0,0,0.5)",
                transition: hovered 
                    ? "transform 0.08s ease-out, box-shadow 0.15s ease-out, border-color 0.3s ease" 
                    : "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s ease",
            }}
        >
            {/* Satin dynamic light sweep */}
            <div 
                className="absolute inset-0 pointer-events-none z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: hovered ? `radial-gradient(circle 120px at ${cursorPos.x}px ${cursorPos.y}px, rgba(255,255,255,0.06) 0%, transparent 80%)` : 'none'
                }}
            />

            {/* Fiber Plastic Texture Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.7)_1px,transparent_1px)] bg-[length:3px_3px] mix-blend-screen z-10" />

            {/* Left accent strip representing playing status led */}
            <div className={cn(
                "absolute left-0 top-0 bottom-0 w-[4.5px] z-20 transition-all duration-300",
                item.status === "Completado" ? "bg-emerald-500 shadow-[2px_0_10px_#10b981]" :
                item.status === "En progreso" ? "bg-sky-500 shadow-[2px_0_10px_#0ea5e9]" :
                "bg-brand-orange shadow-[2px_0_8px_#ff6b00]"
            )} />

            {/* LEFT END SECTION (Arrow + Screw) */}
            <div className="w-[50px] sm:w-[60px] h-full flex flex-col items-center justify-center shrink-0 pl-1.5 border-r border-zinc-900 relative">
                {/* Embedded Screw */}
                <div className="w-2.2 h-2.2 rounded-full bg-[#08090b] shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.95)] border border-zinc-800 flex items-center justify-center relative">
                    <div className="w-[3px] h-[3px] rounded-full bg-zinc-400 flex items-center justify-center relative shadow-[inset_0.2px_0.2px_0.5px_black]">
                        <div className="w-[2px] h-[0.6px] bg-zinc-700 rotate-45" />
                        <div className="w-[2px] h-[0.6px] bg-zinc-700 -rotate-45" />
                    </div>
                </div>
                {/* Embossed arrows */}
                <span className="text-[5.5px] font-black text-zinc-700 tracking-wider font-mono scale-[0.8] mt-2 select-none">
                    ◀ INSERT
                </span>
            </div>

            {/* MIDDLE-LEFT: Recessed Sticker Label */}
            <div className="flex-[1.5] h-[80%] rounded-[3px] bg-zinc-950 p-[1.5px] shadow-[inset_1.5px_2px_4px_rgba(0,0,0,0.9),1px_1px_0px_rgba(255,255,255,0.02)] mx-2 overflow-hidden flex relative select-none">
                <div 
                    className="flex-1 rounded-[2px] text-zinc-900 border-l-[4px] shadow-[1px_1.5px_2.5px_rgba(0,0,0,0.45)] flex flex-row items-center px-2 py-0.5 relative overflow-hidden group/label"
                    style={{ 
                        borderLeftColor: baseColor,
                        backgroundImage: brandStyle.bg,
                        backgroundSize: brandStyle.bgSize,
                        backgroundColor: brandStyle.paperColor,
                    }}
                >
                    {/* Foxing spots aging */}
                    <div 
                        className="absolute inset-0 pointer-events-none opacity-[0.45] mix-blend-multiply z-[1]" 
                        style={{
                            backgroundImage: `
                                radial-gradient(circle at 10% 20%, #caab77 0%, transparent 15%),
                                radial-gradient(circle at 85% 60%, #c0a068 0%, transparent 18%)
                            `,
                            filter: 'blur-[1.5px]'
                        }}
                    />

                    {/* Paper grain */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.05] z-[1] mix-blend-overlay bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.1%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />

                    {/* Label Brand and Handwritten Text */}
                    <div className="flex-1 flex flex-col justify-center min-w-0 pl-1 z-10 font-sans">
                        {/* Brand header */}
                        <div className="text-[6.5px] font-black text-zinc-500 leading-none select-none tracking-widest flex items-center gap-1 uppercase">
                            {retro.brand} <span className="text-[4.5px] font-bold text-zinc-400 bg-zinc-800 px-0.8 py-0.1 rounded">{retro.tapeModel}</span>
                        </div>
                        {/* Cursive Handwriting title */}
                        <div 
                            className="text-[11.5px] sm:text-[13px] font-black tracking-tight line-clamp-1 leading-none mt-1 filter opacity-95 shrink-0"
                            style={{
                                color: retro.handwrittenColor,
                                fontFamily: retro.handwrittenFont,
                                textShadow: '0.3px 0.3px 0px rgba(255,255,255,0.9), -0.3px -0.3px 0px rgba(0,0,0,0.05)'
                            }}
                        >
                            {item.title}
                        </div>
                    </div>

                    {/* Check badge if completed */}
                    {item.status === "Completado" && (
                        <span className="text-[5px] font-black uppercase text-emerald-700 border border-emerald-600/30 px-1 py-0.2 rounded font-mono select-none tracking-wider rotate-[-5deg] shrink-0 scale-90 bg-white/20 backdrop-blur-[0.5px] z-10 ml-1">
                            OK!
                        </span>
                    )}
                </div>
            </div>

            {/* MIDDLE-RIGHT: Acrylic viewing window with spools */}
            <div className="w-[100px] sm:w-[130px] h-[80%] rounded bg-[#090a0d] border border-zinc-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.98)] relative flex items-center justify-around overflow-hidden px-1 sm:px-1.5 shrink-0 mr-1 z-10">
                {/* Glare sheen */}
                <div 
                    className="absolute inset-0 pointer-events-none z-15 mix-blend-screen opacity-55"
                    style={{
                        background: hovered 
                            ? `linear-gradient(120deg, transparent 20%, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.18) 30%, rgba(255,255,255,0.04) 35%, transparent 45%)`
                            : `linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.02) 43%, rgba(255,255,255,0.06) 46%, rgba(255,255,255,0.02) 49%, transparent 52%)`,
                        backgroundSize: '200% 100%',
                        backgroundPosition: hovered ? `${(cursorPos.x / 1.2) - 20}% 0` : '0% 0',
                        transition: 'background-position 0.12s ease-out'
                    }}
                />
                
                {/* Concentric spools */}
                {/* Left Spool */}
                <div className="w-6.5 h-6.5 rounded-full bg-[#111215] border border-zinc-900 flex items-center justify-center relative overflow-hidden shrink-0">
                    <motion.div 
                        className="rounded-full bg-zinc-950 flex items-center justify-center relative" 
                        animate={hovered ? { rotate: 360 } : { rotate: 0 }}
                        transition={hovered ? { repeat: Infinity, duration: 4, ease: "linear" } : { duration: 0.5 }}
                        style={{ 
                            width: '20px', 
                            height: '20px', 
                            border: `${retro.leftSpoolWidth}px solid #36210f`,
                            boxShadow: 'inset 0 0 2px rgba(0,0,0,0.9)'
                        }}
                    >
                        {/* Concentric lines */}
                        <div className="absolute inset-0 rounded-full opacity-[0.2] mix-blend-overlay bg-[repeating-radial-gradient(circle,#000,#000_0.3px,transparent_0.3px,transparent_0.6px)]" />

                        {/* White hub */}
                        <div className="w-2.8 h-2.8 rounded-full bg-[#fcfdfd] border border-zinc-300 shadow-[0_1px_1.5px_rgba(0,0,0,0.6)] flex items-center justify-center relative">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div 
                                    key={i} 
                                    className="absolute w-[0.6px] h-[2.5px] bg-zinc-300 rounded-sm"
                                    style={{ transform: `rotate(${i * 60}deg) translateY(-1.3px)` }}
                                />
                            ))}
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 shadow-inner z-10" />
                        </div>
                    </motion.div>
                </div>

                {/* Tape center divider bridge */}
                <span className="text-[4px] font-black text-zinc-700 tracking-wider font-mono scale-[0.8] select-none z-10">
                    VHS
                </span>

                {/* Right Spool */}
                <div className="w-6.5 h-6.5 rounded-full bg-[#111215] border border-zinc-900 flex items-center justify-center relative overflow-hidden shrink-0">
                    <motion.div 
                        className="rounded-full bg-zinc-950 flex items-center justify-center relative" 
                        animate={hovered ? { rotate: 360 } : { rotate: 0 }}
                        transition={hovered ? { repeat: Infinity, duration: 4, ease: "linear" } : { duration: 0.5 }}
                        style={{ 
                            width: '20px', 
                            height: '20px', 
                            border: `${retro.rightSpoolWidth}px solid #36210f`,
                            boxShadow: 'inset 0 0 2px rgba(0,0,0,0.9)'
                        }}
                    >
                        {/* Concentric lines */}
                        <div className="absolute inset-0 rounded-full opacity-[0.2] mix-blend-overlay bg-[repeating-radial-gradient(circle,#000,#000_0.3px,transparent_0.3px,transparent_0.6px)]" />

                        {/* White hub */}
                        <div className="w-2.8 h-2.8 rounded-full bg-[#fcfdfd] border border-zinc-300 shadow-[0_1px_1.5px_rgba(0,0,0,0.6)] flex items-center justify-center relative">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div 
                                    key={i} 
                                    className="absolute w-[0.6px] h-[2.5px] bg-zinc-300 rounded-sm"
                                    style={{ transform: `rotate(${i * 60}deg) translateY(-1.3px)` }}
                                />
                            ))}
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 shadow-inner z-10" />
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* RIGHT END SECTION (rewind sticker, barcode, dots, screw) */}
            <div className="w-[90px] sm:w-[105px] h-full flex flex-row items-center justify-end shrink-0 gap-1.5 pr-2 border-l border-zinc-900/60 relative">
                {/* Inventory Dot Sticker */}
                {retro.hasColoredDot && (
                    <div 
                        className="w-3.8 h-3.8 rounded-full flex items-center justify-center text-[4px] font-black text-black shadow-[1px_1px_2px_rgba(0,0,0,0.4)] border border-black/10 select-none font-mono shrink-0 scale-90"
                        style={{ 
                            backgroundColor: retro.coloredDotColor, 
                            transform: `rotate(${(typeof item.id === 'number' ? item.id : 0) % 20 - 10}deg)` 
                        }}
                    >
                        {retro.coloredDotText}
                    </div>
                )}

                {/* Pink Be Kind Sticker */}
                {retro.hasBeKindSticker && (
                    <div 
                        className="px-1 py-0.2 rounded bg-[#ff007f] text-white border border-[#ff66b2] shadow-[1px_1.5px_2px_rgba(0,0,0,0.5)] z-25 flex items-center justify-center font-mono font-black uppercase text-[3.8px] tracking-tight rotate-[-4deg] shrink-0 scale-95 select-none"
                    >
                        REWIND
                    </div>
                )}

                {/* Mini Barcode Sticker */}
                <div className="px-1 py-0.2 rounded bg-[#fdfdfc] text-black border border-zinc-300 shadow-[1px_1px_2px_rgba(0,0,0,0.45)] z-20 flex flex-col items-center rotate-[1deg] scale-[0.7] origin-bottom-right shrink-0 select-none">
                    <span className="text-[7px] font-normal leading-none tracking-tighter font-mono text-zinc-950">||||| ||</span>
                    <span className="text-[3px] font-bold leading-none scale-75 text-zinc-700 font-mono">*{retro.code}*</span>
                </div>

                {/* Recessed Screw */}
                <div className="w-2.2 h-2.2 rounded-full bg-[#08090b] shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.95)] border border-zinc-800 flex items-center justify-center relative shrink-0">
                    <div className="w-[3px] h-[3px] rounded-full bg-zinc-400 flex items-center justify-center relative shadow-[inset_0.2px_0.2px_0.5px_black]">
                        <div className="w-[2px] h-[0.6px] bg-zinc-700 rotate-[20deg]" />
                        <div className="w-[2px] h-[0.6px] bg-zinc-700 rotate-[-70deg]" />
                    </div>
                </div>
            </div>
        </motion.div>
    )
})
VhsFlatTape.displayName = "VhsFlatTape"

// ─── Main Stack Component ─────────────────────────────────────────────────────

export const VhsShelfAccordion = memo(function VhsShelfAccordion({
    items,
    onItemClick,
    selectedId,
    onSelectId,
    onHoverItem,
    activeColor,
    className
}: VhsShelfAccordionProps) {
    if (items.length === 0) return null

    return (
        <div className={cn("w-full h-full flex flex-col bg-transparent relative min-h-[460px] md:min-h-[580px]", className)}>
            {/* LED Ambient Glow Strip */}
            <div 
                className="absolute inset-y-12 left-[-16px] w-6 filter blur-[40px] pointer-events-none transition-all duration-1000 opacity-25 z-0 rounded-full"
                style={{ backgroundColor: activeColor || "#ff6b00" }}
            />

            {/* Shelf Cabinet Container Wrapper */}
            <div className="w-full h-full bg-[#08090d]/50 backdrop-blur-xl border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_10px_30px_rgba(0,0,0,0.8)] rounded-3xl p-5 relative overflow-hidden flex flex-col z-10">
                {/* Physical wood/metal cabinets tracks border outlines */}
                <div className="absolute inset-y-0 left-0 w-2.5 bg-[#050608] border-r border-white/[0.03] z-20 shadow-[2px_0_6px_rgba(0,0,0,0.6)]" />
                <div className="absolute inset-y-0 right-0 w-2.5 bg-[#050608] border-l border-white/[0.03] z-20 shadow-[-2px_0_6px_rgba(0,0,0,0.6)]" />

                {/* Cabinet Header Badge */}
                <div className="w-full flex items-center justify-between border-b border-white/[0.04] pb-3 mb-4 px-3 select-none shrink-0">
                    <div className="flex gap-1.5 items-center">
                        <span className="w-2 h-2 rounded-full bg-red-650/40 animate-pulse border border-red-500/20" />
                        <span className="text-[8px] font-black tracking-[0.25em] text-zinc-500 uppercase font-sans">
                            KAMEHOUSE RACK CABINET
                        </span>
                    </div>
                    <span className="text-[8px] font-bold text-zinc-600 font-mono">
                        UNIT-ST-120A
                    </span>
                </div>

                {/* Cassettes Container - Stacked Vertically */}
                <div className="flex-1 w-full flex flex-col gap-2.5 overflow-y-auto no-scrollbar py-3 px-1 min-h-0 select-none">
                    {items.map((item, index) => (
                        <VhsFlatTape
                            key={item.id}
                            item={item}
                            isSelected={selectedId === item.id}
                            onClick={() => {
                                if (selectedId === item.id) {
                                    onItemClick(item)
                                } else {
                                    onSelectId(item.id)
                                }
                            }}
                            onMouseEnter={() => onHoverItem?.(item)}
                            onMouseLeave={() => onHoverItem?.(null)}
                            index={index}
                            totalItems={items.length}
                        />
                    ))}
                </div>

                {/* Cabinet Bottom Shelf Plate */}
                <div className="w-full border-t border-white/[0.04] pt-3.5 mt-2 px-3 flex items-center justify-between text-zinc-500 text-[8px] font-black tracking-widest uppercase font-sans select-none shrink-0">
                    <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                    </div>
                    <span>
                        📼 {items.length} CASSETTES APILADOS
                    </span>
                    <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                    </div>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Caveat:wght@700&family=Nanum+Pen+Script&family=Shadows+Into+Light&display=swap');
            `}} />
        </div>
    )
})
