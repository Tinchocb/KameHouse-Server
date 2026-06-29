import { cn } from "@/components/ui/core/styling";
import * as React from "react";
import { Icons } from "@/components/ui/icons";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "success" | "magic" | "outline" | "glass";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: keyof typeof Icons.ui | keyof typeof Icons.media | keyof typeof Icons.navigation | React.ReactNode;
  rightIcon?: keyof typeof Icons.ui | keyof typeof Icons.media | keyof typeof Icons.navigation | React.ReactNode;
  iconSize?: number;
  fullWidth?: boolean;
  hideTextOnMobile?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-[var(--brand-accent)] text-[var(--primary-foreground)] hover:brightness-110 hover:shadow-[var(--shadow-brand-primary)] active:scale-[0.97]",
  secondary: "bg-[var(--brand-secondary)] text-[var(--secondary-foreground)] hover:brightness-110 hover:shadow-[var(--shadow-brand-secondary)] active:scale-[0.97]",
  destructive: "bg-[var(--brand-destructive)] text-[var(--destructive-foreground)] hover:brightness-110 hover:shadow-[var(--shadow-brand-destructive)] active:scale-[0.97]",
  success: "bg-[var(--brand-success)] text-[var(--bg-primary)] hover:brightness-110 hover:shadow-[var(--shadow-brand-success)] active:scale-[0.97]",
  magic: "bg-[var(--brand-magic)] text-white hover:brightness-110 hover:shadow-[var(--shadow-brand-magic)] active:scale-[0.97]",
  ghost: "bg-transparent text-[var(--text-primary)] hover:bg-[var(--glass-hover)] hover:border-[var(--glass-hover)] border border-transparent active:scale-[0.97]",
  outline: "bg-transparent border border-[var(--glass-border-top)] text-[var(--text-primary)] hover:border-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/10 active:scale-[0.97]",
  glass: "bg-[var(--glass-bg)] backdrop-blur-sm border border-[var(--glass-border-top)] text-[var(--text-primary)] hover:border-[var(--glass-border-top)] hover:bg-[var(--glass-bg-hover)] active:scale-[0.97]",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "text-button-xs h-7 px-3 gap-1.5",
  sm: "text-button-sm h-9 px-4 gap-2",
  md: "text-button-md h-10 px-5 gap-2",
  lg: "text-button-lg h-12 px-6 gap-2.5",
  xl: "text-button-lg h-14 px-8 gap-3",
};

const iconSizeMap: Record<ButtonSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
};

function resolveIcon(icon: GlassButtonProps["leftIcon"], size: number) {
  if (!icon) return null;
  if (typeof icon === "string") {
    const categories = [Icons.ui, Icons.media, Icons.navigation] as const;
    for (const cat of categories) {
      if (icon in cat) {
        const IconComponent = cat[icon as keyof typeof cat];
        return React.createElement(IconComponent, { size, strokeWidth: 2.5 });
      }
    }
  }
  if (React.isValidElement(icon)) {
    return React.cloneElement(icon as React.ReactElement<{ width?: number; height?: number }>, { width: size, height: size });
  }
  return icon;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      iconSize,
      fullWidth = false,
      hideTextOnMobile = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const resolvedIconSize = iconSize ?? iconSizeMap[size];
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-fast",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
          "disabled:opacity-50 disabled:pointer-events-none",
          "tap-scale",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          "rounded-button",
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <svg
              width={resolvedIconSize}
              height={resolvedIconSize}
              className="animate-spin mr-1.5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {children}
          </>
        ) : (
          <>
            {leftIcon && (
              <span className="flex-shrink-0" style={{ marginRight: hideTextOnMobile ? 0 : 8 }}>
                {resolveIcon(leftIcon, resolvedIconSize)}
              </span>
            )}
            <span className={cn(
              hideTextOnMobile && "hidden sm:inline-block",
              leftIcon && !hideTextOnMobile && "pl-1",
              rightIcon && !hideTextOnMobile && "pr-1"
            )}>
              {children}
            </span>
            {rightIcon && (
              <span className="flex-shrink-0" style={{ marginLeft: hideTextOnMobile ? 0 : 8 }}>
                {resolveIcon(rightIcon, resolvedIconSize)}
              </span>
            )}
          </>
        )}
      </button>
    )
  }
);

GlassButton.displayName = "GlassButton";

export const IconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon: keyof typeof Icons.ui | keyof typeof Icons.media | keyof typeof Icons.navigation | React.ReactNode;
  iconSize?: number;
  "aria-label": string;
}>(
  ({ variant = "glass", size = "md", icon, iconSize, "aria-label": ariaLabel, className, children, ...props }, ref) => {
    const resolvedIconSize = iconSize ?? iconSizeMap[size];
    const categories = [Icons.ui, Icons.media, Icons.navigation] as const;
    let iconElement: React.ReactNode = null;

    if (typeof icon === "string") {
      for (const cat of categories) {
        if (icon in cat) {
          const IconComponent = cat[icon as keyof typeof cat];
          iconElement = React.createElement(IconComponent, { size: resolvedIconSize, strokeWidth: 2.5 });
          break;
        }
      }
    } else if (React.isValidElement(icon)) {
      iconElement = React.cloneElement(icon as React.ReactElement<{ width?: number; height?: number }>, { width: resolvedIconSize, height: resolvedIconSize });
    } else {
      iconElement = icon;
    }

    return (
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center justify-center transition-all duration-fast",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
          "disabled:opacity-50 disabled:pointer-events-none",
          "tap-scale",
          variantStyles[variant],
          size === "xs" && "h-7 w-7",
          size === "sm" && "h-9 w-9",
          size === "md" && "h-10 w-10",
          size === "lg" && "h-12 w-12",
          size === "xl" && "h-14 w-14",
          "rounded-button",
          className
        )}
        {...props}
      >
        {iconElement}
        {children}
      </button>
    )
  }
);
IconButton.displayName = "IconButton";