import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { motion } from "framer-motion"

export interface CassetteSeriesItem {
    id: string
    title: string
    artwork: string
    colorHex: string // e.g., "#FF7A00"
    logoUrl?: string
}

export interface StackedCassetteSeriesProps {
    series: CassetteSeriesItem[]
    onSelectSeries?: (id: string) => void
    className?: string
}

export function StackedCassetteSeries(props: StackedCassetteSeriesProps) {
    const { series, onSelectSeries, className } = props

    const [hoveredId, setHoveredId] = React.useState<string | null>(null)

    return (
        <div className={cn("w-full flex justify-center py-10 overflow-x-hidden", className)}>
            <div className="flex flex-row items-end justify-center gap-2 md:gap-4 lg:gap-6 px-4">
                {series.map((item, index) => {
                    const isHovered = hoveredId === item.id

                    return (
                        <motion.div
                            key={item.id}
                            className={cn(
                                "relative w-24 sm:w-32 md:w-48 lg:w-64 h-[250px] sm:h-[350px] md:h-[450px]",
                                "cursor-pointer rounded-md md:rounded-lg overflow-hidden border border-white/10",
                                "bg-neutral-900 flex-shrink-0 origin-bottom"
                            )}
                            initial={{ opacity: 0, y: 50, rotateX: 20 }}
                            animate={{ opacity: 1, y: 0, rotateX: 0 }}
                            transition={{
                                duration: 0.5,
                                delay: index * 0.1,
                                type: "spring",
                                stiffness: 100,
                                damping: 15
                            }}
                            whileHover={{
                                scale: 1.05,
                                y: -10,
                                zIndex: 10,
                                transition: { duration: 0.3, ease: "easeOut" }
                            }}
                            onHoverStart={() => setHoveredId(item.id)}
                            onHoverEnd={() => setHoveredId(null)}
                            onClick={() => onSelectSeries?.(item.id)}
                            style={{
                                boxShadow: isHovered
                                    ? `0 20px 40px ${item.colorHex}40, 0 0 20px ${item.colorHex}60`
                                    : "0 10px 30px rgba(0,0,0,0.5)"
                            }}
                        >
                            {/* Artwork Background */}
                            <img
                                src={item.artwork}
                                alt={item.title}
                                className={cn(
                                    "absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out",
                                    isHovered ? "scale-110" : "scale-100 grayscale-[0.2]"
                                )}
                            />

                            {/* Frosted Glass Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                            {/* Animated Accent Glow on Hover */}
                            <div
                                className="absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none mix-blend-overlay"
                                style={{
                                    opacity: isHovered ? 0.4 : 0,
                                    background: `linear-gradient(to top, ${item.colorHex}, transparent)`
                                }}
                            />

                            {/* Logo / Text Title */}
                            <div className="absolute bottom-0 w-full p-4 flex flex-col items-center justify-end h-1/2">
                                {item.logoUrl ? (
                                    <img
                                        src={item.logoUrl}
                                        alt={item.title}
                                        className={cn(
                                            "w-full object-contain mb-2 transition-transform duration-300",
                                            isHovered ? "scale-110 drop-shadow-2xl" : "scale-100"
                                        )}
                                        style={{
                                            filter: isHovered ? `drop-shadow(0 0 10px ${item.colorHex}80)` : ""
                                        }}
                                    />
                                ) : (
                                    <h3
                                        className={cn(
                                            "text-white font-black text-center text-lg md:text-2xl tracking-tighter transition-all duration-300",
                                            isHovered && "scale-110"
                                        )}
                                        style={{
                                            textShadow: isHovered ? `0 0 10px ${item.colorHex}` : "0 2px 4px rgba(0,0,0,0.8)"
                                        }}
                                    >
                                        {item.title}
                                    </h3>
                                )}
                            </div>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}
