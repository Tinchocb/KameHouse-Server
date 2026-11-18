import { IconUiAlert } from "@/components/ui/icons";

interface DangerZoneProps {
    title: string
    description: string
    actions?: React.ReactNode
    children?: React.ReactNode
}

export function DangerZone({ title, description, actions, children }: DangerZoneProps) {
    return (
        <div className="border border-status-error/25 border-t-status-error/30 rounded-2xl p-4 md:p-6 space-y-4 relative overflow-hidden group/danger [@media(hover:hover)_and_(pointer:fine)]:hover:border-status-error/40 transition-[border-color] duration-fast ease-smooth-out bg-[var(--neutral-elev-1)]">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-status-error/15 border border-status-error/30 flex items-center justify-center text-status-error shrink-0">
                    <IconUiAlert className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-base font-bold text-brand-destructive tracking-tight">{title}</h3>
                    <p className="text-caption text-label-2 leading-relaxed font-medium max-w-prose">{description}</p>
                </div>
            </div>
            {actions && <div className="sm:pl-14">{actions}</div>}
            {children && <div className="sm:pl-14 pt-4 space-y-3">{children}</div>}
        </div>
    )
}
