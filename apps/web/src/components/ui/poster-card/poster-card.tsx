import { cn } from "@/components/ui/core/styling";
import * as React from "react";
import { Play, Info, Plus, Check, Clock, Star, Sparkles } from "lucide-react";
import { getHighResImage, getMediumResImage, getLowResImage } from "@/lib/helpers/images";
import { DeferredImage } from "@/components/shared/deferred-image";
import { GlassButton } from "@/components/ui/glass-button";
import { Icons } from "@/components/ui/icons";

export type PosterAspect = "poster" | "landscape" | "square" | "ultrawide";
export type PosterSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface PosterCardProps {
  artwork: string;
  title: string;
  subtitle?: string;
  badge?: string;
  mediaTypeBadge?: string;
  availabilityType?: "FULL_LOCAL" | "HYBRID" | "ONLY_ONLINE";
  description?: string;
  aspect?: PosterAspect;
  progress?: number;
  year?: string | number;
  rating?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  seasonNumber?: number;
  onClick?: () => void;
  onHover?: () => void;
  onPopupOpenChange?: (isOpen: boolean) => void;
  className?: string;
  layoutId?: string;
  variant?: "default" | "continue-watching" | "featured" | "compact";
  showQuickActions?: boolean;
  isSelected?: boolean;
}

const aspectClasses: Record<PosterAspect, string> = {
  poster: "aspect-[2/3]",
  landscape: "aspect-[16/9]",
  square: "aspect-square",
  ultrawide: "aspect-[21/9]",
};

const sizeClasses: Record<PosterSize, string> = {
  xs: "w-[100px]",
  sm: "w-[140px]",
  md: "w-[180px]",
  lg: "w-[220px]",
  xl: "w-[280px]",
};

const variantStyles = {
  default: "",
  "continue-watching": "relative",
  featured: "relative",
  compact: "",
};

export const PosterCard = React.memo(function PosterCard({
  artwork,
  title,
  subtitle,
  badge,
  mediaTypeBadge,
  availabilityType,
  description,
  aspect = "poster",
  progress,
  year,
  rating,
  episodeNumber,
  episodeTitle,
  onClick,
  onHover,
  onPopupOpenChange,
  className,
  layoutId,
  variant = "default",
  showQuickActions = true,
  isSelected = false,
}: PosterCardProps) {
  const isPoster = aspect === "poster";
  const [isHovered, setIsHovered] = React.useState(false);
  const [showPopup, setShowPopup] = React.useState(false);
  const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = React.useCallback(() => {
    setIsHovered(true);
    onHover?.();
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setShowPopup(true);
      onPopupOpenChange?.(true);
    }, 300);
  }, [onHover, onPopupOpenChange]);

  const handleMouseLeave = React.useCallback(() => {
    setIsHovered(false);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowPopup(false);
    onPopupOpenChange?.(false);
  }, [onPopupOpenChange]);

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const cleanDesc = React.useMemo(
    () => description?.replace(/<[^>]*>/g, "") ?? "",
    [description]
  );

  const vibes = React.useMemo(() => {
    if (!subtitle) return [];
    const keywords = ["EPIC", "CHILL", "EMOTIONAL", "HYPE", "INTENSE", "ÉPICO", "ESENCIAL", "LOCAL", "RELLENO", "ESPECIAL"];
    return subtitle
      .split("·")
      .map((s) => s.trim())
      .filter((s) => keywords.includes(s.toUpperCase()));
  }, [subtitle]);

  const sizeClass = sizeClasses.md;
  const aspectClass = aspectClasses[aspect];
  const variantClass = variantStyles[variant];

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={cn(
        "relative shrink-0 select-none group",
        aspectClass,
        sizeClass,
        variantClass,
        className
      )}
style={{ viewTransitionName: layoutId ? `poster-${layoutId}` : undefined }}
      >
      <div
        className={cn(
          "absolute inset-0 overflow-hidden flex flex-col origin-top",
          "transition-all duration-slow ease-smooth",
          showPopup
            ? cn(
                "z-[100] bg-[var(--bg-tertiary)]/95 backdrop-blur-xl border border-[var(--glass-border)] shadow-modal",
                isPoster
                  ? "-top-[10%] -left-[10%] w-[120%] h-[130%] rounded-2xl"
                  : "-top-[12%] -left-[8%] w-[116%] h-[130%] rounded-2xl"
              )
            : cn(
                "z-10 w-full h-full bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)] hover:border-[var(--brand-primary)]/30 hover:shadow-[var(--shadow-brand-primary)] shadow-card cursor-pointer group",
                isPoster ? "rounded-xl" : "rounded-2xl"
              )
        )}
        style={{
          willChange: showPopup ? "transform, opacity" : "auto",
        }}
      >
        {showPopup && (
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--brand-primary)]/10 via-transparent to-transparent pointer-events-none rounded-[inherit] opacity-50" />
        )}

        <div className={cn("relative w-full overflow-hidden shrink-0", showPopup ? "aspect-[16/9]" : "h-full")}>
          <DeferredImage
            src={getMediumResImage(artwork)}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-1000 ease-smooth group-hover:scale-[1.05]"
          />

          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/20 to-transparent transition-opacity duration-slow",
            showPopup ? "opacity-100" : "opacity-75 group-hover:opacity-90"
          )} />

          {!showPopup && (
            <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-[inherit]">
              <div
                className={cn(
                  "w-1/3 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 absolute inset-y-0 transition-transform duration-700 ease-out -translate-x-[150%]",
                  isHovered && "translate-x-[150%]"
                )}
              />
            </div>
          )}

          {episodeNumber !== undefined && (
            <div className="absolute top-0 left-0 z-20">
              <div className="bg-[var(--bg-primary)]/80 backdrop-blur-sm text-[var(--text-muted)] border-r border-b border-[var(--glass-border)] px-3 py-1.5 rounded-br-xl font-black text-[10px] tracking-[0.15em] uppercase flex items-center gap-1 shadow-md">
                <span>EP</span>
                <span className="text-[var(--brand-primary)]">{episodeNumber}</span>
              </div>
            </div>
          )}

          {mediaTypeBadge && (
            <div className="absolute top-0 right-0 z-20">
              <div className="bg-[var(--bg-primary)]/80 backdrop-blur-sm text-[var(--text-muted)] border-l border-b border-[var(--glass-border)] px-2.5 py-1 rounded-bl-xl font-black text-[8px] tracking-[0.2em] uppercase shadow-md">
                {mediaTypeBadge}
              </div>
            </div>
          )}

          {badge && !showPopup && (
            <div className="absolute top-0 left-0 z-20 m-2">
              <span className="badge-primary px-2 py-1 text-[9px]">{badge}</span>
            </div>
          )}

          {availabilityType && !showPopup && (
            <div className="absolute top-0 right-0 z-20 m-2">
              <span className={cn(
                "badge px-2 py-1 text-[9px]",
                availabilityType === "FULL_LOCAL" && "badge-success",
                availabilityType === "HYBRID" && "badge-secondary",
                availabilityType === "ONLY_ONLINE" && "badge-magic"
              )}>
                {availabilityType === "FULL_LOCAL" && "✓ Local"}
                {availabilityType === "HYBRID" && "☁ Híbrido"}
                {availabilityType === "ONLY_ONLINE" && "🌐 Online"}
              </span>
            </div>
          )}

          {showPopup && showQuickActions && (
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
              <GlassButton
                variant="primary"
                size="sm"
                leftIcon="play"
                iconSize={14}
                className="h-9 w-9 p-0 justify-center rounded-full shadow-lg hover:scale-110 hover:shadow-[var(--shadow-brand-primary)]"
              />
              <GlassButton
                variant="glass"
                size="sm"
                leftIcon="plus"
                iconSize={14}
                className="h-9 w-9 p-0 justify-center rounded-full"
              />
              <GlassButton
                variant="glass"
                size="sm"
                leftIcon="info"
                iconSize={14}
                className="h-9 w-9 p-0 justify-center rounded-full"
              />
            </div>
          )}

          {!showPopup && (
            <div className="absolute inset-0 z-10 flex flex-col justify-end p-3 md:p-4 transition-transform duration-slow ease-out group-hover:translate-y-[-2px]">
              <div className="space-y-1.5">
                <h3 className="text-h6 font-display text-primary line-clamp-1">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-caption text-muted uppercase tracking-wider line-clamp-1 group-hover:text-secondary transition-colors duration-fast">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          )}

          {progress !== undefined && (
            <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-[var(--glass-border)]">
              <div
                className="h-full bg-[var(--brand-primary)] shadow-[var(--shadow-brand-primary)] transition-all duration-base"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          )}
        </div>

        <div
          className={cn(
            "p-3 md:p-4 space-y-2 overflow-hidden bg-[var(--bg-tertiary)]/90 transition-all duration-slow ease-out",
            showPopup
              ? "opacity-100 max-h-[200px] pointer-events-auto"
              : "opacity-0 max-h-0 py-0 pointer-events-none"
          )}
        >
          <div className="space-y-2">
            <h3 className="text-h5 font-display text-primary line-clamp-1">
              {title}
            </h3>

            <div className="flex flex-wrap items-center gap-1.5 text-caption font-bold uppercase tracking-wider text-muted">
              {rating && (
                <span className="text-[var(--brand-success)] font-extrabold flex items-center gap-1">
                  <Star size={10} fill="currentColor" />
                  {(rating * 10).toFixed(0)}%
                </span>
              )}
              {year && <span className="text-secondary font-medium">{year}</span>}
              {badge && (
                <span className="badge-muted text-[8px] px-1.5 py-0.5">
                  {badge}
                </span>
              )}
              {episodeTitle && (
                <span className="text-[var(--text-muted)] text-[9px]">
                  {episodeTitle}
                </span>
              )}
            </div>

            {vibes.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {vibes.slice(0, 3).map((vibe, idx) => (
                  <span
                    key={idx}
                    className="badge text-[7px] tracking-widest bg-[var(--brand-primary)]/15 border-[var(--brand-primary)]/30 text-[var(--brand-primary)] px-2 py-0.5 flex items-center gap-1"
                  >
                    <Sparkles size={8} className="animate-pulse" />
                    {vibe}
                  </span>
                ))}
              </div>
            )}

            {description && (
              <p className="line-clamp-3 text-body-xs leading-relaxed text-muted pt-1">
                {cleanDesc}
              </p>
            )}

            {showQuickActions && showPopup && (
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--glass-border)]">
                <GlassButton
                  variant="primary"
                  size="sm"
                  leftIcon="play"
                  className="flex-1"
                >
                  Reproducir
                </GlassButton>
                <GlassButton
                  variant="outline"
                  size="sm"
                  leftIcon="info"
                  className="flex-1"
                >
                  Detalles
                </GlassButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {isSelected && (
        <div className="absolute inset-0 border-2 border-[var(--brand-primary)] rounded-[inherit] pointer-events-none opacity-50" />
      )}
    </div>
  );
});

PosterCard.displayName = "PosterCard";

export interface PosterGridProps {
  items: PosterCardProps[];
  columns?: { base?: number; sm?: number; md?: number; lg?: number; xl?: number };
  gap?: number;
  onItemClick?: (item: PosterCardProps) => void;
}

export function PosterGrid({ items, columns, gap = 4, onItemClick }: PosterGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns && `
          grid-cols-${columns.base ?? 2}
          sm:grid-cols-${columns.sm ?? 3}
          md:grid-cols-${columns.md ?? 4}
          lg:grid-cols-${columns.lg ?? 5}
          xl:grid-cols-${columns.xl ?? 6}
        `
      )}
      style={{ gap: `${gap}px` }}
    >
      {items.map((item, index) => (
        <PosterCard
          key={item.layoutId ?? item.title ?? index}
          {...item}
          onClick={() => onItemClick?.(item)}
        />
      ))}
    </div>
  );
}

export function PosterCarousel({ items, onItemClick, className }: PosterGridProps) {
  return (
    <div className={cn("scroll-snap-carousel", className)}>
      {items.map((item, index) => (
        <PosterCard
          key={item.layoutId ?? item.title ?? index}
          {...item}
          onClick={() => onItemClick?.(item)}
        />
      ))}
    </div>
  );
}