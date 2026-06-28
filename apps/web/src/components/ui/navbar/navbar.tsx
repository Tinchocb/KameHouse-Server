import { cn } from "@/components/ui/core/styling";
import * as React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Icons } from "@/components/ui/icons";
import { GlassButton, IconButton } from "@/components/ui/glass-button";
import { useAppStore } from "@/lib/store";
import { useResponsive } from "@/hooks/use-responsive";

export interface NavbarProps {
  className?: string;
}

export function Navbar({ className }: NavbarProps) {
  const { isMobile } = useResponsive();
  const sidebarOpen = useAppStore(state => state.sidebarOpen);
  const setSidebarOpen = useAppStore(state => state.setSidebarOpen);
  const tvMode = useAppStore(state => state.tvMode);
  const location = useLocation();

  if (tvMode) return null;

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-[var(--z-navbar)] flex items-center justify-between",
        "px-4 md:px-6 h-[64px]",
        "bg-[var(--glass-bg)] backdrop-blur-[var(--blur-navbar)]",
        "border-b border-[var(--glass-border-top)]",
        "shadow-[var(--shadow-glass)]",
        className
      )}
      style={{
        borderBottom: "1px solid var(--glass-border-top)",
      }}
    >
      <div className="flex items-center gap-3 md:gap-4">
        <IconButton
          variant="glass"
          size="md"
          icon="menu"
          aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden"
        />

        <Link
          to="/home"
          className="flex items-center gap-2 shrink-0"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="relative">
            <img
              src="/kamehouse-logo.png"
              alt="KameHouse"
              className="h-8 w-8 object-contain"
            />
            <div className="absolute inset-0 bg-[var(--brand-accent)]/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-slow rounded-full" />
          </div>
          {!isMobile && (
            <span className="font-display text-xl text-primary tracking-wider whitespace-nowrap">
              KAMEHOUSE
            </span>
          )}
        </Link>

        <div className="hidden md:flex items-center gap-1 ml-2">
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
                  ? "text-primary bg-[var(--brand-accent)]/10"
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
          leftIcon="search"
          className="hidden sm:inline-flex"
        >
          Buscar
        </GlassButton>

        <IconButton
          variant="glass"
          size="sm"
          icon="bell"
          aria-label="Notificaciones"
          className="hidden md:inline-flex relative"
        >
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--brand-destructive)] rounded-full text-[9px] font-black flex items-center justify-center">
            3
          </span>
        </IconButton>

        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--brand-accent)] to-[var(--era-dbz-hsl)] flex items-center justify-center font-bold text-[var(--primary-foreground)] text-sm ring-2 ring-[var(--bg-primary)]">
          M
        </div>

        <IconButton
          variant="glass"
          size="md"
          icon="chevronDown"
          aria-label="Menú usuario"
          className="md:hidden"
        />
      </div>
    </nav>
  );
}

export function NavbarSpacer() {
  return <div className="h-[64px]" aria-hidden="true" />;
}