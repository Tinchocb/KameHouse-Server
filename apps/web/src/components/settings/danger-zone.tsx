import { IconUiAlert } from "@/components/ui/icons";

export interface DangerZoneProps {
    title: string
    description: string
    actions?: React.ReactNode
    children?: React.ReactNode
}

export function DangerZone({ title, description, actions, children }: DangerZoneProps) {
    return (
        <div className="border border-red-500/25 border-t-red-400/30 rounded-2xl p-4 md:p-6 space-y-4 relative overflow-hidden group/danger hover:border-red-400/40 transition-colors bg-zinc-950/40 backdrop-blur-overlay-2xl backdrop-saturate-[150%] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.15),0_12px_36px_-6px_rgba(0,0,0,0.85)]">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-[0_0_14px_rgba(239,68,68,0.25)]">
                    <IconUiAlert className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-base font-bold text-brand-destructive tracking-tight">{title}</h3>
                    <p className="text-caption text-on-surface-variant leading-relaxed font-medium">{description}</p>
                </div>
            </div>
            {actions && <div className="pl-14">{actions}</div>}
            {children && <div className="pl-14 pt-4 space-y-3">{children}</div>}
        </div>
    )
}
