import * as React from "react"
import { motion } from "framer-motion"
import { useNavigate } from "@tanstack/react-router"
import { cn } from "@/components/ui/core/styling"
import { Film } from "lucide-react"

// ─── Saga Configurations & Navigation Targets ────────────────────────────────

const HUBS = [
    {
        id: "db-original",
        title: "Dragon Ball",
        subtitle: "EL ORIGEN",
        target: { to: "/series/$seriesId" as const, params: { seriesId: "12609" } },
        logoStyle: "font-black tracking-tight text-amber-500 drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]",
        glowColor: "group-hover:shadow-[0_0_30px_rgba(245,158,11,0.25)] group-hover:border-amber-500/30",
        particles: "db" as const
    },
    {
        id: "dbz",
        title: "Dragon Ball Z",
        subtitle: "SAGA SAIYAJIN",
        target: { to: "/series/$seriesId" as const, params: { seriesId: "12971" } },
        logoStyle: "font-black tracking-tighter text-yellow-400 drop-shadow-[0_2px_8px_rgba(234,179,8,0.5)]",
        glowColor: "group-hover:shadow-[0_0_30px_rgba(234,179,8,0.25)] group-hover:border-yellow-500/30",
        particles: "dbz" as const
    },
    {
        id: "dbgt",
        title: "Dragon Ball GT",
        subtitle: "VIAJE GALÁCTICO",
        target: { to: "/series/$seriesId" as const, params: { seriesId: "12697" } },
        logoStyle: "font-extrabold tracking-wide text-zinc-300 drop-shadow-[0_2px_8px_rgba(161,161,170,0.5)]",
        glowColor: "group-hover:shadow-[0_0_30px_rgba(239,68,68,0.2)] group-hover:border-red-500/30",
        particles: "dbgt" as const
    },
    {
        id: "dbs",
        title: "Dragon Ball Super",
        subtitle: "KI DIVINO",
        target: { to: "/series/$seriesId" as const, params: { seriesId: "62715" } },
        logoStyle: "font-black tracking-normal text-sky-400 drop-shadow-[0_2px_8px_rgba(56,189,248,0.5)]",
        glowColor: "group-hover:shadow-[0_0_30px_rgba(139,92,246,0.25)] group-hover:border-violet-500/30",
        particles: "dbs" as const
    },
    {
        id: "movies",
        title: "Películas",
        subtitle: "CINE Z",
        target: { to: "/movies" as const },
        logoStyle: "font-bold tracking-[0.2em] text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]",
        glowColor: "group-hover:shadow-[0_0_30px_rgba(250,204,21,0.2)] group-hover:border-yellow-400/30",
        particles: "movies" as const
    }
]

// ─── High-Performance Canvas Particle Emitter ────────────────────────────────

interface HubCanvasProps {
    type: "db" | "dbz" | "dbgt" | "dbs" | "movies"
    isHovered: boolean
}

const HubCanvas = React.memo(function HubCanvas({ type, isHovered }: HubCanvasProps) {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
    const animationFrameId = React.useRef<number | null>(null)

    React.useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        let width = (canvas.width = canvas.offsetWidth)
        let height = (canvas.height = canvas.offsetHeight)

        // Handle resize
        const handleResize = () => {
            if (!canvas) return
            width = canvas.width = canvas.offsetWidth
            height = canvas.height = canvas.offsetHeight
        }
        window.addEventListener("resize", handleResize)

        // Particle blueprints
        interface Particle {
            x: number
            y: number
            size: number
            speedX: number
            speedY: number
            alpha: number
            color: string
            decay: number
            angle?: number
            spin?: number
            amplitude?: number
            frequency?: number
        }

        let particles: Particle[] = []

        // DB Classic: Orange spheres + golden stars
        const initDB = () => {
            if (particles.length > 15) return
            particles.push({
                x: Math.random() * width,
                y: height + 20,
                size: Math.random() * 8 + 6,
                speedX: (Math.random() - 0.5) * 0.4,
                speedY: -(Math.random() * 0.5 + 0.3),
                alpha: Math.random() * 0.4 + 0.3,
                color: "245, 158, 11", // Orange
                decay: Math.random() * 0.001 + 0.0005,
                angle: Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * 0.02
            })
        }

        // DBZ: Golden Super Saiyan aura + lightning
        const initDBZ = () => {
            if (particles.length > 40) return
            // Yellow aura sparks rising
            particles.push({
                x: Math.random() * width,
                y: height - Math.random() * 10,
                size: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * 0.8,
                speedY: -(Math.random() * 1.8 + 0.8),
                alpha: Math.random() * 0.6 + 0.4,
                color: Math.random() > 0.3 ? "234, 179, 8" : "253, 224, 71", // Gold / light yellow
                decay: Math.random() * 0.008 + 0.004
            })
        }

        // DBGT: Space Crimson dust + starfield
        const initDBGT = () => {
            if (particles.length > 25) return
            particles.push({
                x: Math.random() * width,
                y: height + 10,
                size: Math.random() * 2.5 + 0.8,
                speedX: (Math.random() - 0.5) * 0.3,
                speedY: -(Math.random() * 0.8 + 0.4),
                alpha: Math.random() * 0.5 + 0.3,
                color: Math.random() > 0.4 ? "239, 68, 68" : "248, 113, 113", // Crimson red
                decay: Math.random() * 0.005 + 0.002
            })
        }

        // DBS: Cosmic swirling particles (God/Ultra Instinct)
        const initDBS = () => {
            if (particles.length > 50) return
            // Swirling around dynamic centers
            const centerX = width / 2
            const centerY = height / 2
            const radius = Math.random() * 60 + 20
            const angle = Math.random() * Math.PI * 2
            particles.push({
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
                size: Math.random() * 2 + 0.5,
                speedX: 0,
                speedY: 0,
                alpha: Math.random() * 0.7 + 0.3,
                color: Math.random() > 0.6 ? "139, 92, 246" : (Math.random() > 0.3 ? "56, 189, 248" : "255, 255, 255"), // Violet, Sky-blue, Silver
                decay: Math.random() * 0.006 + 0.003,
                angle: angle,
                spin: Math.random() * 0.02 + 0.015,
                amplitude: radius,
                frequency: Math.random() * 0.05 - 0.025
            })
        }

        // Movies: Golden lens dust
        const initMovies = () => {
            if (particles.length > 15) return
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 4 + 2,
                speedX: (Math.random() - 0.5) * 0.2,
                speedY: -(Math.random() * 0.3 + 0.1),
                alpha: Math.random() * 0.3 + 0.15,
                color: "253, 224, 71", // Gold yellow
                decay: Math.random() * 0.002 + 0.001
            })
        }

        // Drawing a cloud for DB Classic
        const drawCloud = (cCtx: CanvasRenderingContext2D, cx: number, cy: number, r: number, alpha: number) => {
            cCtx.fillStyle = `rgba(245, 158, 11, ${alpha * 0.12})`
            cCtx.beginPath()
            cCtx.arc(cx, cy, r, 0, Math.PI * 2)
            cCtx.arc(cx - r * 0.6, cy + r * 0.2, r * 0.8, 0, Math.PI * 2)
            cCtx.arc(cx + r * 0.6, cy + r * 0.2, r * 0.8, 0, Math.PI * 2)
            cCtx.fill()
        }

        // Dynamic electric discharge arc for DBZ
        let lightningTicks = 0
        let lightningPath: { x: number; y: number }[] = []

        const renderLightning = (cCtx: CanvasRenderingContext2D) => {
            if (Math.random() > 0.94 && lightningPath.length === 0) {
                // Generate new lightning path
                const startX = Math.random() * width
                const startY = height
                const segments = 4
                lightningPath = [{ x: startX, y: startY }]
                let currX = startX
                let currY = startY
                for (let i = 0; i < segments; i++) {
                    currX += (Math.random() - 0.5) * 40
                    currY -= (Math.random() * 30 + 10)
                    lightningPath.push({ x: currX, y: currY })
                }
                lightningTicks = 8 // Frames to show
            }

            if (lightningTicks > 0 && lightningPath.length > 0) {
                cCtx.strokeStyle = `rgba(14, 165, 233, ${lightningTicks / 8 * 0.8})` // Electric sky blue
                cCtx.lineWidth = Math.random() * 2 + 1
                cCtx.shadowColor = "rgba(14, 165, 233, 0.8)"
                cCtx.shadowBlur = 10
                cCtx.beginPath()
                cCtx.moveTo(lightningPath[0].x, lightningPath[0].y)
                for (let i = 1; i < lightningPath.length; i++) {
                    cCtx.lineTo(lightningPath[i].x, lightningPath[i].y)
                }
                cCtx.stroke()
                cCtx.shadowBlur = 0 // Reset
                lightningTicks--
            } else {
                lightningPath = []
            }
        }

        // Main animation loop
        const loop = () => {
            ctx.clearRect(0, 0, width, height)

            if (isHovered) {
                if (type === "db") initDB()
                if (type === "dbz") {
                    initDBZ()
                    renderLightning(ctx)
                }
                if (type === "dbgt") initDBGT()
                if (type === "dbs") initDBS()
                if (type === "movies") initMovies}

            // Draw dynamic background glow reflections
            if (isHovered) {
                const gradient = ctx.createRadialGradient(
                    width / 2, height / 2, 5,
                    width / 2, height / 2, width * 0.6
                )
                if (type === "db") {
                    gradient.addColorStop(0, "rgba(245, 158, 11, 0.08)")
                    gradient.addColorStop(1, "rgba(0,0,0,0)")
                } else if (type === "dbz") {
                    gradient.addColorStop(0, "rgba(234, 179, 8, 0.08)")
                    gradient.addColorStop(1, "rgba(0,0,0,0)")
                } else if (type === "dbgt") {
                    gradient.addColorStop(0, "rgba(239, 68, 68, 0.06)")
                    gradient.addColorStop(1, "rgba(0,0,0,0)")
                } else if (type === "dbs") {
                    gradient.addColorStop(0, "rgba(139, 92, 246, 0.08)")
                    gradient.addColorStop(1, "rgba(0,0,0,0)")
                } else if (type === "movies") {
                    gradient.addColorStop(0, "rgba(255, 255, 255, 0.04)")
                    gradient.addColorStop(1, "rgba(0,0,0,0)")
                }
                ctx.fillStyle = gradient
                ctx.fillRect(0, 0, width, height)
            }

            // Special static/slow clouds for DB Classic background
            if (type === "db" && isHovered) {
                drawCloud(ctx, width * 0.25, height * 0.65, 25, 0.4)
                drawCloud(ctx, width * 0.75, height * 0.35, 30, 0.4)
            }

            // Special cinema flare for Movies
            if (type === "movies" && isHovered) {
                const time = Date.now() * 0.0006
                const flareY = height / 2 + Math.sin(time) * 15
                const flareGlow = ctx.createLinearGradient(0, flareY - 2, width, flareY + 2)
                flareGlow.addColorStop(0, "rgba(253, 224, 71, 0.0)")
                flareGlow.addColorStop(0.3, "rgba(253, 224, 71, 0.03)")
                flareGlow.addColorStop(0.5, "rgba(255, 255, 255, 0.12)")
                flareGlow.addColorStop(0.7, "rgba(253, 224, 71, 0.03)")
                flareGlow.addColorStop(1, "rgba(253, 224, 71, 0.0)")
                ctx.fillStyle = flareGlow
                ctx.fillRect(0, flareY - 12, width, 24)
            }

            // Process particles
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i]

                if (type === "dbs") {
                    // Orbit behavior for Super (swirling cosmos)
                    p.angle = (p.angle ?? 0) + (p.spin ?? 0.01)
                    p.amplitude = (p.amplitude ?? 40) + (p.frequency ?? 0.1)
                    const targetX = width / 2 + Math.cos(p.angle) * p.amplitude
                    const targetY = height / 2 + Math.sin(p.angle) * p.amplitude * 0.75
                    p.x += (targetX - p.x) * 0.1
                    p.y += (targetY - p.y) * 0.1
                } else {
                    p.x += p.speedX
                    p.y += p.speedY
                }

                p.alpha -= p.decay

                // Remove dead particles
                if (p.alpha <= 0 || p.x < -10 || p.x > width + 10 || p.y < -10) {
                    particles.splice(i, 1)
                    continue
                }

                // Render particle
                ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`
                if (type === "db") {
                    // Star shapes or spheres
                    ctx.beginPath()
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
                    ctx.fill()

                    // Star reflection highlights
                    ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.7})`
                    ctx.beginPath()
                    ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.25, 0, Math.PI * 2)
                    ctx.fill()
                } else if (type === "dbz" || type === "dbgt" || type === "dbs" || type === "movies") {
                    // Soft circular sparks
                    ctx.beginPath()
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
                    ctx.fill()

                    // Extra core glow for DBZ
                    if (type === "dbz" && p.size > 2) {
                        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.9})`
                        ctx.beginPath()
                        ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2)
                        ctx.fill()
                    }
                }
            }

            // If not hovered and all particles faded out, suspend loop to save battery
            if (!isHovered && particles.length === 0) {
                animationFrameId.current = null
                ctx.clearRect(0, 0, width, height)
                return
            }

            animationFrameId.current = requestAnimationFrame(loop)
        }

        // Trigger loop initial activation
        if (isHovered || particles.length > 0) {
            if (!animationFrameId.current) {
                animationFrameId.current = requestAnimationFrame(loop)
            }
        }

        return () => {
            window.removeEventListener("resize", handleResize)
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current)
            }
        }
    }, [type, isHovered])

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-out"
        />
    )
})

// ─── Saga Brand Hubs Grid Component ──────────────────────────────────────────

export function SagaBrandHubs() {
    const navigate = useNavigate()
    const [hoveredHub, setHoveredHub] = React.useState<string | null>(null)

    return (
        <div className="relative z-40 px-6 md:px-12 lg:px-20 py-8">
            {/* Grid display: 2 cols on mobile, 5 cols on desktop */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 lg:gap-6">
                {HUBS.map((hub, idx) => {
                    const isHovered = hoveredHub === hub.id
                    return (
                        <motion.div
                            key={hub.id}
                            id={`hub-tile-${hub.id}`}
                            initial={{ opacity: 0, y: 30, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                                delay: idx * 0.06,
                                duration: 0.8,
                                ease: [0.23, 1, 0.32, 1]
                            }}
                            className={cn(
                                "relative overflow-hidden aspect-[16/9] md:aspect-[7/4]",
                                "bg-gradient-to-br from-[#0c0f1d]/90 to-[#070912]/95",
                                "border border-white/5 rounded-2xl cursor-pointer",
                                "shadow-[0_8px_24px_rgba(0,0,0,0.5)] select-none",
                                "transition-all duration-500 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)] group",
                                hub.glowColor
                            )}
                            whileHover={{ 
                                scale: 1.05,
                                y: -4,
                                border: "1px solid rgba(255, 255, 255, 0.2)"
                            }}
                            whileTap={{ scale: 0.97 }}
                            onMouseEnter={() => setHoveredHub(hub.id)}
                            onMouseLeave={() => setHoveredHub(null)}
                            onClick={() => {
                                // Dynamic router navigation
                                if (hub.target.to === "/movies") {
                                    navigate({ to: hub.target.to })
                                } else {
                                    navigate({ 
                                        to: hub.target.to, 
                                        params: (hub.target as any).params 
                                    })
                                }
                            }}
                        >
                            {/* Hover Canvas Particles */}
                            <HubCanvas type={hub.particles} isHovered={isHovered} />

                            {/* Disney+ style inner reflection ring overlay */}
                            <div className="absolute inset-0 rounded-2xl border border-white/0 group-hover:border-white/10 pointer-events-none transition-colors duration-500 z-30" />

                            {/* Inner ambient glow behind text */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />

                            {/* Logo Graphic Label */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-20 transition-transform duration-500 ease-out group-hover:scale-105">
                                {hub.id === "movies" ? (
                                    <div className="flex flex-col items-center gap-1.5">
                                        <Film className="w-5 h-5 text-white/40 group-hover:text-yellow-400 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 ease-out" />
                                        <span className={cn("text-lg md:text-xl font-bold uppercase", hub.logoStyle)}>
                                            {hub.title}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        {/* Stylized custom saga labels */}
                                        <span className={cn(
                                            "text-lg md:text-[1.35rem] font-extrabold uppercase text-center leading-none",
                                            hub.logoStyle
                                        )}>
                                            {hub.title}
                                        </span>
                                        {hub.id === "dbz" && (
                                            <span className="absolute -right-1 top-2.5 text-red-600 font-black italic text-3xl opacity-20 group-hover:opacity-100 group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 select-none">
                                                Z
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Small, elegant bottom tag descriptor */}
                            <div className="absolute bottom-2.5 left-0 right-0 flex justify-center z-20 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500 ease-out">
                                <span className="text-[0.55rem] font-black uppercase tracking-[0.25em] text-white/40">
                                    {hub.subtitle}
                                </span>
                            </div>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}
