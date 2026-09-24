import React from "react";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/components/ui/core/styling";
import { useSpringPreset } from "@/components/ui/kinetics/hooks";
import { IconNavigationChevronDown } from "@/components/ui/icons";

export interface SectionBarProps {
  id?: string;
  label: string;
  description?: string;
  icon?: React.ElementType;
  badge?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  searchQuery?: string;
  variant?: "default" | "strong" | "minimal";
  className?: string;
  layoutId?: string;
}

export function SectionBar({
  id,
  label,
  description,
  icon: Icon,
  badge,
  children,
  collapsible = false,
  defaultOpen = true,
  isOpen: controlledIsOpen,
  onOpenChange,
  searchQuery,
  variant = "default",
  className,
  layoutId,
}: SectionBarProps) {
  const [internalIsOpen, setInternalIsOpen] = React.useState(defaultOpen);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const handleToggle = () => {
    const next = !isOpen;
    if (!isControlled) {
      setInternalIsOpen(next);
    }
    onOpenChange?.(next);
  };
  const isSearching = !!searchQuery && searchQuery.trim().length > 0;
  const collapseSpring = useSpringPreset("tabContent");

  const baseClasses = cn(
    "sectionbar",
    variant === "strong" && "sectionbar-strong",
    variant === "minimal" && "sectionbar-minimal",
    "scroll-mt-28",
    className
  );

  if (!collapsible) {
    if (layoutId) {
      return (
        <m.div id={id} layoutId={layoutId} transition={collapseSpring} className={cn(baseClasses, "space-y-3.5", "p-5 md:p-6")}>
          <div className="sectionbar-header">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="sectionbar-header-icon">
                  <Icon className="w-4 h-4" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="sectionbar-header-title">{label}</h3>
                  {badge && <span className="sectionbar-header-badge">{badge}</span>}
                </div>
                {description && (
                  <p className="sectionbar-header-desc">{description}</p>
                )}
              </div>
            </div>
          </div>
          <div className="sectionbar-divide">{children}</div>
        </m.div>
      );
    }
    return (
      <div id={id} className={cn(baseClasses, "space-y-3.5", "p-5 md:p-6")}>
        <div className="sectionbar-header">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="sectionbar-header-icon">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="sectionbar-header-title">{label}</h3>
                {badge && <span className="sectionbar-header-badge">{badge}</span>}
              </div>
              {description && (
                <p className="sectionbar-header-desc">{description}</p>
              )}
            </div>
          </div>
        </div>
        <div className="sectionbar-divide">{children}</div>
      </div>
    );
  }

  const showContent = isOpen || isSearching;
  const Wrapper = layoutId ? m.div : "div";
  const wrapperProps = layoutId ? { layoutId, transition: collapseSpring } : {};

  return (
    <Wrapper id={id} className={baseClasses} {...wrapperProps}>
      <button
        type="button"
        onClick={handleToggle}
        className="w-full px-4 sm:px-5 py-3 flex items-center justify-between text-left hover:bg-white/[0.04] transition-colors group select-none cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3.5 min-w-0 pr-4">
          {Icon ? (
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/15 border-t-white/30 flex items-center justify-center text-on-surface shrink-0 group-hover:scale-105 transition-transform duration-200 ease-out shadow-inner">
              <Icon className="w-3.5 h-3.5 text-on-surface" />
            </div>
          ) : (
            <div className="w-1.5 h-4.5 rounded-full bg-brand-accent shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-white font-mono group-hover:text-brand-accent transition-colors truncate text-balance">
                {label}
              </h3>
              {badge}
            </div>
            {description && (
              <p className="text-2xs text-on-surface-variant/75 leading-normal font-medium line-clamp-1 mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        <div
          className={cn(
            "w-6.5 h-6.5 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-on-surface-variant group-hover:text-white group-hover:bg-white/[0.08] transition-[transform,background-color,border-color,color] duration-base ease-smooth-out shrink-0",
            showContent && "rotate-180 text-white bg-white/10 border-white/20"
          )}
        >
          <IconNavigationChevronDown className="w-3.5 h-3.5" />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {showContent && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={collapseSpring}
            className="overflow-hidden border-t border-white/[0.08]"
          >
            <div className="p-4 sm:p-5 space-y-3.5 sectionbar-divide">
              {children}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </Wrapper>
  );
}

SectionBar.displayName = "SectionBar";