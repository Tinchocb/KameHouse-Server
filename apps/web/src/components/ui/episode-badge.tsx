import React from "react";
import { cn } from "./core/styling";

export type EpisodeBadgeVariant = "premium";

interface EpisodeBadgeProps {
    variant?: EpisodeBadgeVariant;
    dot?: boolean;
    children?: React.ReactNode;
    className?: string;
}

export function EpisodeBadge({ dot = false, children, className }: EpisodeBadgeProps) {
    return (
        <span className={cn("badge badge-primary", className)}>
            {dot && (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-brand-accent" />
            )}
            {children}
        </span>
    );
}
