import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/components/ui/core/styling";
import { useSpringPreset } from "@/components/ui/kinetics/hooks";

export interface SectionBarProps {
  id?: string;
  label: string;
  description?: string;
  icon?: React.ElementType;
  badge?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
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
  searchQuery,
  variant = "default",
  className,
  layoutId,
}: SectionBarProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const isSearching = !!searchQuery && searchQuery.trim().length > 0;
  const collapseSpring = useSpringPreset("tabContent");
  const tabIndicatorSpring = useSpringPreset("tabIndicator");

  const baseClasses = cn(
    "sectionbar",
    variant === "strong" && "sectionbar-strong",
    variant === "minimal" && "sectionbar-minimal",
    "scroll-mt-28",
    className
  );

  if (!collapsible) {
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

  return (
    <div id={id} className={baseClasses}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 sm:px-5 py-3 flex items-center justify-between text-left hover:bg-white/[0.04] transition-colors group select-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3.5 min-w-0 pr-4">
          {Icon ? (
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/15 border-t-white/30 flex items-center justify-center text-on-surface shrink-0 group-hover:scale-105 transition-all shadow-inner">
              <Icon className="w-3.5 h-3.5 text-on-surface" />
            </div>
          ) : (
            <div className="w-1.5 h-4.5 rounded-full bg-brand-accent shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-white font-mono group-hover:text-brand-accent transition-colors truncate">
                {label}
              </h3>
              {badge}
            </div>
            {description && (
              <p className="text-[11px] text-on-surface-variant/75 leading-normal font-medium line-clamp-1 mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        <div
          className={cn(
            "w-6.5 h-6.5 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-on-surface-variant group-hover:text-white group-hover:bg-white/[0.08] transition-all shrink-0",
            showContent && "rotate-180 text-white bg-white/10 border-white/20"
          )}
        >
          <motion.div
            layoutId={layoutId}
            transition={tabIndicatorSpring}
            className="w-3.5 h-3.5"
          >
            {Icon ? (
              <Icon className="w-3.5 h-3.5 rotate-180" />
            ) : (
              <div className="w-1.5 h-4.5 rounded-full bg-white/[0.04] border border-white/10 border-t-white/30 shrink-0" />
            )}
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {showContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={collapseSpring}
            className="overflow-hidden border-t border-white/[0.08]"
          >
            <div className="p-4 sm:p-5 space-y-3.5 sectionbar-divide">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

SectionBar.displayName = "SectionBar";