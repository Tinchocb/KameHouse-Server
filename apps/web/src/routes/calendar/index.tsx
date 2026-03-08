import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useGetAnimeCollectionSchedule } from "@/api/hooks/anime_collection.hooks"
import { useMemo, useState } from "react"
import { cn } from "@/components/ui/core/styling"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"
import type { Anime_ScheduleItem } from "@/api/generated/types"

export const Route = createFileRoute("/calendar/")({
    component: CalendarPage,
})

// --- Date Helpers ---
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay() // 0 = Sunday

const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

function CalendarPage() {
    const navigate = useNavigate()
    const { data: scheduleData, isLoading } = useGetAnimeCollectionSchedule()
    const scheduleItems = (scheduleData || []) as any[]

    const [currentDate, setCurrentDate] = useState(() => {
        const now = new Date()
        return { year: now.getFullYear(), month: now.getMonth() }
    })

    const today = new Date()

    const handlePrevMonth = () => {
        setCurrentDate(prev => {
            const nextMonth = prev.month - 1
            if (nextMonth < 0) return { year: prev.year - 1, month: 11 }
            return { year: prev.year, month: nextMonth }
        })
    }

    const handleNextMonth = () => {
        setCurrentDate(prev => {
            const nextMonth = prev.month + 1
            if (nextMonth > 11) return { year: prev.year + 1, month: 0 }
            return { year: prev.year, month: nextMonth }
        })
    }

    const handleToday = () => {
        setCurrentDate({ year: today.getFullYear(), month: today.getMonth() })
    }

    // Process schedule data for the current month
    // Assuming schedule items have an 'airingAt' unix timestamp (seconds). Fallback to standard object parsing.
    const monthEvents = useMemo(() => {
        const eventsMap = new Map<number, any[]>()

        scheduleItems.forEach((item) => {
            // Need to handle timestamps or ISO strings gracefully. Assuming airingAt is mostly used.
            const dateVal = item.airingAt ? item.airingAt * 1000 : (item.timestamp || Date.now())
            const date = new Date(dateVal)

            if (date.getFullYear() === currentDate.year && date.getMonth() === currentDate.month) {
                const day = date.getDate()
                if (!eventsMap.has(day)) eventsMap.set(day, [])
                eventsMap.get(day)!.push({
                    ...item,
                    parsedDate: date
                })
            }
        })

        return eventsMap
    }, [scheduleItems, currentDate])

    // Generate Calendar Grid logic
    const daysInMonth = getDaysInMonth(currentDate.year, currentDate.month)
    const firstDay = getFirstDayOfMonth(currentDate.year, currentDate.month)

    // We want the calendar to start on Sunday (0) or Monday (1). 
    // Usually, 0 is Sunday, so if firstDay is 3 (Wednesday), we need 3 empty slots.
    const paddingDays = Array.from({ length: firstDay }, (_, i) => i)
    const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

    // Calculate trailing days to complete the grid (usually 6 rows = 42 cells)
    const totalCells = paddingDays.length + monthDays.length
    const trailingLength = totalCells > 35 ? 42 - totalCells : 35 - totalCells
    const trailingDays = Array.from({ length: trailingLength }, (_, i) => i + 1)


    return (
        <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10 font-sans">

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                        <CalendarIcon className="w-8 h-8 text-orange-500" />
                        CALENDARIO DE <span className="text-orange-500">EMISIONES</span>
                    </h1>
                    <p className="text-zinc-400 mt-2 text-sm max-w-xl leading-relaxed">
                        Sigue los próximos episodios y estrenos programados de tu biblioteca. Los horarios están ajustados a tu zona local.
                    </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-xl border border-white/5">
                    <button
                        onClick={handlePrevMonth}
                        className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex flex-col items-center min-w-[140px]">
                        <span className="text-lg font-black uppercase tracking-widest text-white">
                            {MONTH_NAMES[currentDate.year === today.getFullYear() && currentDate.month === today.getMonth() ? today.getMonth() : currentDate.month]}
                        </span>
                        <span className="text-[10px] text-orange-500 font-black tracking-widest">
                            {currentDate.year}
                        </span>
                    </div>
                    <button
                        onClick={handleNextMonth}
                        className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>

                    <div className="w-px h-6 bg-white/10 mx-2" />

                    <button
                        onClick={handleToday}
                        className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-zinc-300 transition-all border border-transparent hover:border-white/10"
                    >
                        Hoy
                    </button>
                </div>
            </header>

            {/* Loading Overlay */}
            {isLoading && (
                <div className="w-full flex justify-center py-12">
                    <div className="flex flex-col items-center gap-3 animate-pulse">
                        <CalendarIcon className="w-8 h-8 text-orange-500" />
                        <span className="text-zinc-400 text-sm font-bold uppercase tracking-widest">Cargando eventos...</span>
                    </div>
                </div>
            )}

            {/* Content Board */}
            {!isLoading && (
                <main className="flex-1 flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">

                    {/* Days Header */}
                    <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-950/50">
                        {DAY_NAMES.map((d, i) => (
                            <div key={d} className={cn(
                                "py-3 text-center text-[10px] md:text-xs font-black uppercase tracking-widest text-zinc-500",
                                i === 0 && "text-orange-500/70", // Sunday
                                i === 6 && "text-orange-500/70", // Saturday
                            )}>
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-zinc-900">
                        {/* Empty prefix cells */}
                        {paddingDays.map((_, i) => (
                            <div key={`pad-${i}`} className="min-h-[120px] md:min-h-[160px] border-r border-b border-zinc-800/50 bg-zinc-950/30" />
                        ))}

                        {/* Actual Days */}
                        {monthDays.map((day) => {
                            const isToday = day === today.getDate() && currentDate.month === today.getMonth() && currentDate.year === today.getFullYear()
                            const events = monthEvents.get(day) || []

                            return (
                                <div
                                    key={`day-${day}`}
                                    className={cn(
                                        "min-h-[120px] md:min-h-[160px] border-r border-b border-zinc-800/50 p-1 md:p-2 transition-colors flex flex-col gap-1 overflow-hidden group/cell",
                                        isToday ? "bg-zinc-800/40 border-orange-500/20" : "hover:bg-zinc-800/20",
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-1 px-1">
                                        <span className={cn(
                                            "text-xs md:text-sm font-black w-6 h-6 flex items-center justify-center rounded-full",
                                            isToday ? "bg-orange-500 text-white shadow-[0_0_12px_rgba(255,122,0,0.6)]" : "text-zinc-500 group-hover/cell:text-zinc-300 transition-colors"
                                        )}>
                                            {day}
                                        </span>
                                        {events.length > 0 && (
                                            <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider hidden md:block">
                                                {events.length} eps
                                            </span>
                                        )}
                                    </div>

                                    {/* Event Thumbnails */}
                                    <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto scrollbar-hide">
                                        {events.map((ev, idx) => {
                                            // Secure mapping for typical schedule formats from AniList
                                            const mediaId = ev.media?.id || ev.mediaId
                                            const img = ev.media?.posterImage || ev.media?.coverImage || ""
                                            const title = ev.media?.titleEnglish || ev.media?.titleRomaji || "Emisión"
                                            const epNum = ev.episode || ev.episodeNumber

                                            const timeString = ev.parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

                                            return (
                                                <button
                                                    key={`${mediaId}-${epNum}-${idx}`}
                                                    onClick={() => navigate({ to: `/series/${mediaId}` })}
                                                    className="w-full text-left flex items-start gap-2 p-1.5 rounded-lg bg-zinc-950/60 hover:bg-zinc-800 border border-white/5 hover:border-orange-500/30 transition-all group"
                                                >
                                                    {/* Mini Thumbnail */}
                                                    <div className="w-8 h-12 md:w-10 md:h-14 rounded-md overflow-hidden bg-zinc-900 shrink-0">
                                                        {img ? (
                                                            <img src={img} alt={title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-[8px] text-zinc-600 bg-zinc-800">No img</div>
                                                        )}
                                                    </div>

                                                    {/* Event Metadata */}
                                                    <div className="flex flex-col flex-1 overflow-hidden py-0.5">
                                                        <span className="text-[9px] md:text-[10px] font-mono text-orange-400 mb-0.5 font-bold">
                                                            {timeString}
                                                        </span>
                                                        <h4 className="text-[10px] md:text-xs font-bold text-zinc-300 group-hover:text-white truncate">
                                                            {title}
                                                        </h4>
                                                        {epNum && (
                                                            <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider flex-1 mt-auto">
                                                                Ep. {epNum}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}

                        {/* Trailing empty cells */}
                        {trailingDays.map((_, i) => (
                            <div key={`trail-${i}`} className="min-h-[120px] md:min-h-[160px] border-r border-b border-zinc-800/50 bg-zinc-950/30 line-through text-[10px] text-zinc-700/30 flex items-start justify-end p-2" />
                        ))}
                    </div>
                </main>
            )}
        </div>
    )
}
