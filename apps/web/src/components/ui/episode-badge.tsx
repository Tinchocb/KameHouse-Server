import React from "react";
import { cn } from "./core/styling";

interface EpisodeBadgeProps {
    children?: React.ReactNode;
    className?: string;
}

export function EpisodeBadge({ children, className }: EpisodeBadgeProps) {
    return (
        <span className={cn("badge badge-primary", className)}>
            {children}
        </span>
    );
}
