import * as React from "react"
import { createPortal } from "react-dom"
import { m, AnimatePresence } from "framer-motion"
import { cn } from "@/components/ui/core/styling"
import { IconStatusFileVideo, IconStatusCpu, IconUiInfo, IconUiBell, IconUiInbox } from "@/components/ui/icons"
import { HoldConfirm } from "@/components/ui/kinetics"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"
import { useResponsive } from "@/hooks/use-responsive"
import { useGetNotifications, useMarkNotificationsRead, useClearNotifications } from "@/api/hooks/notifications.hooks"
import type { Models_Notification } from "@/api/generated/types"

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    scanner: IconStatusFileVideo,
    mediastream: IconStatusCpu,
    system: IconUiInfo,
}

function relativeTime(dateStr?: string): string {
    if (!dateStr) return ""
    const date = new Date(dateStr)
    const diffSec = Math.round((date.getTime() - Date.now()) / 1000)
    const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" })
    const abs = Math.abs(diffSec)
    if (abs < 60) return rtf.format(Math.round(diffSec), "second")
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute")
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour")
    return rtf.format(Math.round(diffSec / 86400), "day")
}

/**
 * Notification bell + dropdown panel. Shows the unread badge, and on open marks
 * everything as read. New notifications arrive via the WebSocket provider, which
 * invalidates the query this component reads.
 */
export function NotificationBell({ sidebarOpen = false, compact = false }: { sidebarOpen?: boolean; compact?: boolean }) {
    const { isMobile } = useResponsive()
    const [open, setOpen] = React.useState(false)
    const panelSpring = useSpringPreset("tabContent")
    const badgeSpring = useSpringPreset("tabIndicator")
    const bellRef = React.useRef<HTMLButtonElement>(null)
    const panelRef = React.useRef<HTMLDivElement>(null)

    const { data } = useGetNotifications()
    const { mutate: markRead } = useMarkNotificationsRead()
    const { mutate: clearAll } = useClearNotifications()

    const notifications = data?.notifications ?? []
    const unreadCount = data?.unreadCount ?? 0

    const handleToggle = () => {
        const next = !open
        setOpen(next)
        if (next && unreadCount > 0) {
            markRead({})
        }
    }

    // Cierre con Escape + foco gestionado (el panel no es modal: no bloquea interacción)
    React.useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                setOpen(false)
                bellRef.current?.focus()
            }
        }
        document.addEventListener('keydown', onKey)
        panelRef.current?.focus()
        return () => {
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    return (
        <>
            <div className={cn("flex justify-center", !compact && "w-full")}>
                <button
                    ref={bellRef}
                    onClick={handleToggle}
                    title="Notificaciones"
                    aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : "Notificaciones"}
                    aria-expanded={open}
                    aria-haspopup="dialog"
                    aria-controls="notification-panel"
                    className={cn(
                        "flex items-center group relative transition-[background-color,border-color,color,transform] duration-base active:scale-95 font-bold cursor-pointer",
                        compact
                            ? "h-11 w-11 justify-center rounded-full text-on-surface-variant hover:text-on-surface"
                            : [
                                "h-14 rounded-xl px-4 border border-white/[0.06] hover:border-white/[0.12] w-full",
                                sidebarOpen ? "justify-start gap-4 px-5" : "justify-center md:w-14 md:px-0",
                                open
                                    ? "text-on-surface bg-white/[0.08]"
                                    : "text-on-surface-variant hover:text-on-surface bg-white/[0.03] hover:bg-white/[0.07]",
                            ]
                    )}
                >
                    <span className={cn("shrink-0 z-10 relative group-hover:scale-110 transition-transform duration-base", open && "text-on-surface")}>
                        <IconUiBell className="w-5 h-5" />
                        <AnimatePresence>
                            {unreadCount > 0 && (
                                <m.span
                                    key="unread-badge"
                                    initial={{ scale: 0.3, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.3, opacity: 0 }}
                                    transition={badgeSpring}
                                    className="absolute -top-2.5 -right-2.5 bg-brand-accent text-on-primary text-label-sm font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center border border-surface px-[3px] shadow-[0_0_10px_hsl(var(--brand-accent)/0.6)]"
                                >
                                    {unreadCount > 99 ? "99+" : unreadCount}
                                </m.span>
                            )}
                        </AnimatePresence>
                    </span>
                    {!compact && (
                        <span className={cn(
                            "uppercase tracking-ultra text-label-sm font-black z-10 text-left transition-colors whitespace-nowrap",
                            (sidebarOpen || isMobile) ? "block" : "hidden md:hidden",
                            open ? "text-on-surface" : "group-hover:text-on-surface"
                        )}>
                            Notificaciones
                        </span>
                    )}
                </button>
            </div>

            {open && typeof document !== "undefined" && createPortal(
                <AnimatePresence>
                    {/* Click-outside catcher (solo puntero; por teclado: Escape o la campana) */}
                    <m.div
                        key="notif-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-overlay"
                        onClick={() => setOpen(false)}
                    />
                    <m.div
                        key="notif-panel"
                        ref={panelRef}
                        tabIndex={-1}
                        role="dialog"
                        id="notification-panel"
                        aria-label="Notificaciones"
                        initial={{ opacity: 0, scale: 0.95, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -6 }}
                        transition={panelSpring}
                        className={cn(
                            "fixed z-popover flex flex-col overflow-hidden",
                            "bg-surface/80 backdrop-blur-overlay-2xl backdrop-saturate-[190%] border border-white/20 border-t-white/40 border-b-white/10 rounded-2xl shadow-[shadow:var(--glass-highlight-lg),0_20px_50px_rgba(0,0,0,0.9)]",
                            // origin-*: la escala de entrada nace del lado donde está anclado el panel
                            isMobile
                                ? "top-16 left-3 right-3 max-h-[65vh] origin-top-right"
                                : "left-24 bottom-6 w-[380px] max-h-[70vh] origin-bottom-left"
                        )}
                    >
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
                            <span className="text-on-surface text-label-sm font-black uppercase tracking-widest font-mono">
                                Notificaciones
                            </span>
                            {notifications.length > 0 && (
                                <HoldConfirm
                                    onConfirm={() => clearAll(undefined)}
                                    holdDurationMs={800}
                                    label="Limpiar"
                                    confirmLabel="¡Vaciado!"
                                    className="min-h-[44px] px-3 py-0.5 text-3xs tracking-wider"
                                />
                            )}
                        </div>

                        <div className="overflow-y-auto flex-1">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center gap-3 py-12 text-on-surface-variant">
                                    <IconUiInbox className="w-8 h-8 opacity-60" />
                                    <span className="text-body-md">No hay notificaciones</span>
                                </div>
                            ) : (
                                notifications.map((n: Models_Notification) => {
                                    const TypeIcon = TYPE_ICONS[n.type] ?? IconUiInfo
                                    return (
                                        <div
                                            key={n.id}
                                            className={cn(
                                                "flex items-start gap-3 px-5 py-4 border-b border-white/[0.06] last:border-b-0 transition-colors duration-base",
                                                !n.read && "bg-white/[0.04]"
                                            )}
                                        >
                                            <TypeIcon className="w-4 h-4 mt-0.5 shrink-0 text-brand-accent" />
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <span className="text-on-surface text-label-md font-bold truncate">{n.title}</span>
                                                <span className="text-on-surface-variant text-body-md break-words">{n.message}</span>
                                                <span className="text-on-surface-variant/70 text-label-sm font-mono">{relativeTime(n.createdAt)}</span>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </m.div>
                </AnimatePresence>,
                document.body
            )}
        </>
    )
}
