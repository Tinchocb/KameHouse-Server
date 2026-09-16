import React from "react";
import { cn } from "./core/styling";

export type EpisodeBadgeVariant = "filler" | "canon" | "premium" | "neutral";

interface EpisodeBadgeProps {
    variant: EpisodeBadgeVariant;
    dot?: boolean;
    children?: React.ReactNode;
    className?: string;
}

const variantClassMap: Record<EpisodeBadgeVariant, string> = {
    canon: "badge-success",
    filler: "badge-warning",
    premium: "badge-primary",
    neutral: "badge-muted",
};

export function EpisodeBadge({ variant, dot = false, children, className }: EpisodeBadgeProps) {
    return (
        <span className={cn("badge", variantClassMap[variant], className)}>
            {dot && (
                <span className={cn(
                    "w-1.5 h-1.5 rounded-full animate-pulse",
                    variant === "canon" ? "bg-brand-success" : 
                    variant === "filler" ? "bg-brand-warning" : 
                    variant === "premium" ? "bg-brand-accent" : 
                    "bg-on-surface-variant"
                )} />
            )}
            {children}
        </span>
    );
}
