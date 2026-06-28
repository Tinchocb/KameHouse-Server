import { cn } from "@/components/ui/core/styling";
import * as React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Icons } from "@/components/ui/icons";
import { GlassButton } from "@/components/ui/glass-button";
import { useAppStore } from "@/lib/store";
import { useResponsive } from "@/hooks/use-responsive";

interface NavbarProps {
  className?: string;
  transparent?: boolean;
  floating?: boolean;
}

export function Navbar({ className, transparent = true, floating = true }: NavbarProps) {
  const { isMobile } = useResponsive();
  const sidebarOpen = useAppStore(state => state.sidebarOpen);
  const setSidebarOpen = useAppStore(state => state.setSidebarOpen);
  const tvMode = useAppStore(state => state.tvMode);
  const location = useLocation();
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const shouldShowGlass = !transparent || scrolled;

  if (tvMode) return null;

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-[var(--z-navbar)] flex items-center justify-between transition-all duration-base",
        floating && "mx-4 mt-4 rounded-2xl",
        !floating && "rounded-none",
        shouldShowGlass
          ? "glass-strong px-6 py-4 shadow-navbar"
          : "px-6 py-4 bg-transparent",
        className
      )}
      style={{
        backdropFilter: shouldShowGlass ? `blur(var(--blur-xl)) saturate(1.3)` : "none",
        background: shouldShowGlass ? "var(--glass-bg)" : "transparent",
        borderColor: shouldShowGlass ? "var(--glass-strong)" : "transparent",
        boxShadow: shouldShowGlass ? "var(--shadow-elevated)" : "none",
      }}
    >
      <div className="flex items-center gap-4">
        <GlassButton
          variant="ghost"
          size="md"
          icon="menu"
          iconSize={20}
          aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden"
        >
          <Icons.navigation.menu size={20} strokeWidth={2.5} />
        </GlassButton>

        <Link to="/home" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
          <div className="relative">
            <img
              src="/kamehouse-logo.png"
              alt="KameHouse"
              className="h-8 w-8 object-contain"
            />
            <div className="absolute inset-0 bg-[var(--brand-primary)]/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-slow rounded-full" />
          </div>
          {!isMobile && (
            <span className="font-display text-xl text-primary tracking-wider whitespace-nowrap">
              KAMEHOUSE
            </span>
          )}
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {[
            { to: "/home", label: "Inicio", icon: Icons.navigation.home },
            { to: "/series", label: "Series", icon: Icons.navigation.tv },
            { to: "/movies", label: "Películas", icon: Icons.navigation.film },
            { to: "/collections", label: "Colecciones", icon: Icons.navigation.layers },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-label-md font-medium transition-all duration-fast",
                location.pathname === item.to
                  ? "text-primary bg-[var(--brand-primary)]/10"
                  : "text-muted hover:text-primary hover:bg-[var(--glass-hover)]"
              )}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={16} strokeWidth={2.5} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <GlassButton
          variant="glass"
          size="sm"
          icon="search"
          aria-label="Buscar"
          className="hidden sm:inline-flex"
        >
          <Icons.ui.search size={16} strokeWidth={2.5} />
        </GlassButton>

        <GlassButton
          variant="glass"
          size="sm"
          icon="bell"
          aria-label="Notificaciones"
          className="hidden md:inline-flex relative"
        >
          <Icons.ui.bell size={16} strokeWidth={2.5} />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--brand-destructive)] rounded-full text-[9px] font-black flex items-center justify-center">
            3
          </span>
        </GlassButton>

        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-secondary)] flex items-center justify-center font-bold text-[var(--primary-foreground)] text-sm ring-2 ring-[var(--bg-primary)]">
          M
        </div>

        <GlassButton
          variant="ghost"
          size="md"
          icon="chevronDown"
          iconSize={18}
          aria-label="Menú usuario"
          className="md:hidden"
        >
          <Icons.arrow.down size={18} strokeWidth={2.5} />
        </GlassButton>
      </div>
    </nav>
  );
}

export function NavbarSpacer() {
  return <div className="h-[72px] md:h-[80px]" aria-hidden="true" />;
}