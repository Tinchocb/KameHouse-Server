import { cn } from "@/components/ui/core/styling";
import * as React from "react";

export type BadgeVariant = "primary" | "secondary" | "success" | "magic" | "muted" | "destructive";
export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: "bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border-[var(--brand-accent)]/30",
  secondary: "bg-[var(--brand-secondary)]/15 text-[var(--brand-secondary)] border-[var(--brand-secondary)]/30",
  success: "bg-[var(--brand-success)]/15 text-[var(--brand-success)] border-[var(--brand-success)]/30",
  magic: "bg-[var(--brand-magic)]/15 text-[var(--brand-magic)] border-[var(--brand-magic)]/30",
  muted: "bg-[var(--glass-bg)] text-[var(--text-muted)] border-[var(--glass-border-top)]",
  destructive: "bg-[var(--brand-destructive)]/15 text-[var(--brand-destructive)] border-[var(--brand-destructive)]/30",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "text-[10px] px-2 py-0.5 gap-1",
  md: "text-badge px-2.5 py-1 gap-1.5",
  lg: "text-caption px-3 py-1.5 gap-2",
};

const dotStyles: Record<BadgeVariant, string> = {
  primary: "bg-[var(--brand-accent)]",
  secondary: "bg-[var(--brand-secondary)]",
  success: "bg-[var(--brand-success)]",
  magic: "bg-[var(--brand-magic)]",
  muted: "bg-[var(--text-muted)]",
  destructive: "bg-[var(--brand-destructive)]",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "muted", size = "md", dot = false, className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center font-bold uppercase tracking-widest border",
          "rounded-full",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {dot && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotStyles[variant])} />}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";