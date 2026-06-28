import { cn } from "@/components/ui/core/styling";
import * as React from "react";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "interactive" | "popup" | "strong";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  radius?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
  blur?: "xs" | "sm" | "md" | "lg" | "xl";
  hover?: boolean;
  onClick?: () => void;
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
  xl: "p-8",
} as const;

const radiusMap = {
  xs: "rounded-xs",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
  full: "rounded-full",
} as const;

const variantClasses = {
  default: "bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-md shadow-card glass-inner",
  elevated: "bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-lg shadow-elevated glass-inner",
  interactive: "bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-md shadow-card glass-inner cursor-pointer transition-all duration-base hover:border-[var(--glass-hover)] hover:bg-[var(--glass-hover)] hover:shadow-elevated active:scale-[0.98]",
  popup: "bg-[var(--glass-bg)] border border-[var(--glass-strong)] backdrop-blur-xl shadow-modal glass-inner-strong",
  strong: "bg-[var(--glass-bg)] border border-[var(--glass-strong)] backdrop-blur-xl shadow-modal glass-inner-strong",
} as const;

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      variant = "default",
      padding = "md",
      radius = "lg",
      blur,
      hover = false,
      onClick,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isInteractive = variant === "interactive" || onClick || hover;

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden",
          variantClasses[variant],
          radiusMap[radius],
          paddingMap[padding],
          blur && `backdrop-blur-${blur}`,
          isInteractive && "tap-scale",
          className
        )}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }} : undefined}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export const GlassCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("mb-4", className)} {...props}>
      {children}
    </div>
  )
);
GlassCardHeader.displayName = "GlassCardHeader";

export const GlassCardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-h4 text-primary", className)} {...props} />
  )
);
GlassCardTitle.displayName = "GlassCardTitle";

export const GlassCardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-body-sm text-muted mt-1", className)} {...props} />
  )
);
GlassCardDescription.displayName = "GlassCardDescription";

export const GlassCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(className)} {...props} />
  )
);
GlassCardContent.displayName = "GlassCardContent";

export const GlassCardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-3 mt-4 pt-4 border-t border-[var(--glass-border)]", className)} {...props} />
  )
);
GlassCardFooter.displayName = "GlassCardFooter";