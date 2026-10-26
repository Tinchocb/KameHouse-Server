import React from "react";
import { m, AnimatePresence, useIsPresent, type Transition } from "framer-motion";
import { cn } from "@/components/ui/core/styling";
import { useSpringPreset } from "@/components/ui/kinetics/hooks";
import { useScrollReveal } from "@/components/ui/kinetics/scroll-reveal";
import { IconNavigationChevronDown } from "@/components/ui/icons";

interface SectionBarProps {
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
  /** `content`: superficie de contenido (translúcida en Neutro con vidrio) y títulos en sentence-case. */
  variant?: "default" | "strong" | "minimal" | "content";
  className?: string;
  layoutId?: string;
  /** Nivel del título. h2 por defecto (cuelga del h1 de la página); h3 si la barra va dentro de otra sección. */
  headingLevel?: "h2" | "h3";
}

function CollapsibleContent({ children, transition, triggerRef }: {
  children: React.ReactNode;
  transition: Transition;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const isPresent = useIsPresent();
  const contentRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (!isPresent && contentRef.current?.contains(document.activeElement)) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [isPresent, triggerRef]);
  return (
    <m.div
      ref={contentRef}
      inert={!isPresent}
      aria-hidden={!isPresent}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={transition}
      className="overflow-hidden border-t border-white/[0.08]"
    >
      <div className="p-4 sm:p-5 space-y-3.5 sectionbar-divide">{children}</div>
    </m.div>
  );
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
  headingLevel: Heading = "h2",
}: SectionBarProps) {
  const [internalIsOpen, setInternalIsOpen] = React.useState(defaultOpen);
  const panelId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
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
  // Las secciones que están más abajo entran con el revelado de scroll. No se
  // aplica con layoutId: ahí framer controla el transform del contenedor.
  const revealRef = React.useRef<HTMLDivElement>(null);
  useScrollReveal(revealRef);

  const isContent = variant === "content";
  // Sentence case y sans: la clase global `.sectionbar-header-title` (mono, mayúsculas) ya no se usa acá.
  const titleClass = isContent ? "type-headline text-on-surface" : "text-sm font-bold text-on-surface";
  const baseClasses = cn(
    isContent ? "surface-content rounded-2xl transition-colors duration-base ease-smooth-out" : "sectionbar",
    variant === "strong" && "sectionbar-strong",
    variant === "minimal" && "sectionbar-minimal",
    "scroll-mt-28",
    className
  );

  if (!collapsible) {
    if (layoutId) {
      return (
        <m.div id={id} layoutId={layoutId} transition={collapseSpring} className={cn(baseClasses, "space-y-3.5", variant === "minimal" ? "py-5 md:py-6" : "p-5 md:p-6")}>
          <div className="sectionbar-header">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="sectionbar-header-icon">
                  <Icon className="w-4 h-4" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <Heading className={titleClass}>{label}</Heading>
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
      <div id={id} ref={revealRef} className={cn(baseClasses, "space-y-3.5", variant === "minimal" ? "py-5 md:py-6" : "p-5 md:p-6")}>
        <div className="sectionbar-header">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="sectionbar-header-icon">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <Heading className={titleClass}>{label}</Heading>
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
    <Wrapper id={id} ref={layoutId ? undefined : revealRef} className={baseClasses} {...wrapperProps}>
      <Heading>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          // Resaltado en un ::before inset y redondeado: no toca los bordes de la tarjeta ni el divisor inferior.
          "relative isolate w-full px-4 sm:px-5 py-3 flex items-center justify-between text-left group select-none cursor-pointer outline-none",
          "before:content-[''] before:absolute before:inset-x-2 before:inset-y-1 before:-z-10 before:rounded-xl before:bg-white/[0.05] before:opacity-0",
          "before:transition-[opacity,background-color] before:duration-fast before:ease-out-strong motion-reduce:before:transition-none",
          "[@media(hover:hover)_and_(pointer:fine)]:hover:before:opacity-100 active:before:opacity-100 active:before:bg-white/[0.08]",
          "focus-visible:before:opacity-100 focus-visible:before:ring-1 focus-visible:before:ring-inset focus-visible:before:ring-brand-accent/50"
        )}
        aria-expanded={showContent}
        aria-controls={panelId}
      >
        <span className="flex items-center gap-3.5 min-w-0 pr-4">
          {Icon ? (
            <span className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/15 border-t-white/30 flex items-center justify-center text-on-surface shrink-0 group-hover:scale-105 transition-transform duration-fast ease-out-strong shadow-inner">
              <Icon className="w-3.5 h-3.5 text-on-surface" />
            </span>
          ) : (
            <span className="w-1.5 h-4.5 rounded-full bg-brand-accent shrink-0" />
          )}
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className={cn(isContent ? "type-headline text-on-surface" : "text-sm font-bold text-on-surface", "group-hover:text-brand-accent-readable transition-colors truncate text-balance")}>
                {label}
              </span>
              {badge}
            </span>
            {description && (
              <span className="text-2xs text-label-2 leading-normal font-medium line-clamp-1 mt-0.5">
                {description}
              </span>
            )}
          </span>
        </span>
        <span
          className={cn(
            "w-6.5 h-6.5 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-on-surface-variant group-hover:text-on-surface group-hover:bg-white/[0.08] transition-[transform,background-color,border-color,color] duration-base ease-smooth-out shrink-0",
            showContent && "rotate-180 text-on-surface bg-white/10 border-white/20"
          )}
        >
          <IconNavigationChevronDown className="w-3.5 h-3.5" />
        </span>
      </button>
      </Heading>

      <div id={panelId}>
      <AnimatePresence initial={false}>
        {showContent && (
          <CollapsibleContent
            transition={collapseSpring}
            triggerRef={triggerRef}
          >
            {children}
          </CollapsibleContent>
        )}
      </AnimatePresence>
      </div>
    </Wrapper>
  );
}

SectionBar.displayName = "SectionBar";
