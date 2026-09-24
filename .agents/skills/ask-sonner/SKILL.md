---
name: ask-sonner
description: Buenas prácticas, configuración y patrones para notificaciones Sonner en KameHouse (Toaster único, theming dark con tokens SectionBar, promise toasts, z-index y stacking).
---

# Ask Sonner (KameHouse Edition)

Pautas de integración, theming y experiencia de usuario para notificaciones vía Sonner en KameHouse (`apps/web`), alineadas al sistema de diseño canónico (`docs/DESIGN-GUIDE.md`).

## 1. Regla de Oro: Toaster Único en Root

- Solo debe existir una única instancia de `<Toaster />` en la aplicación, ubicada en el shell global (`routes/__root.tsx` o provider de UI raíz).
- **NUNCA** declarar o montar `<Toaster />` en componentes hijos, páginas individuales, pestañas de settings o modales. Si se duplica, provoca desincronización de toasts y comportamientos erráticos de stacking.

## 2. Theming Dark y Tokens SectionBar

Las notificaciones deben lucir como extensiones naturales del lenguaje visual de KameHouse (dark-first, glass sutil, bordes con rim luminoso):

```tsx
// Configuración recomendada para Toaster en KameHouse
<Toaster
  theme="dark"
  position="bottom-right"
  toastOptions={{
    className: cn(
      "sectionbar !bg-[var(--sectionbar-bg)] !text-foreground",
      "!border !border-[var(--sectionbar-border)] !border-t-[var(--sectionbar-border-top)]",
      "!shadow-elevation-4 !rounded-2xl backdrop-blur-overlay-xl",
      "font-sans text-sm"
    ),
    descriptionClassName: "!text-zinc-400 font-sans text-xs",
    actionButtonStyle: {
      borderRadius: "9999px",
      fontWeight: 500,
      fontSize: "0.8125rem",
      minHeight: "36px",
      paddingLeft: "0.875rem",
      paddingRight: "0.875rem",
    },
    cancelButtonStyle: {
      borderRadius: "9999px",
      fontSize: "0.8125rem",
      minHeight: "36px",
      paddingLeft: "0.875rem",
      paddingRight: "0.875rem",
    }
  }}
/>
```

- **Fondo**: Usar `--sectionbar-bg` (`rgba(20, 20, 25, 0.85)` en modo flotante) con `backdrop-blur-overlay-xl`.
- **Borde**: `border-[var(--sectionbar-border)]` con `border-t-[var(--sectionbar-border-top)]` para el rim luminoso de 35% de opacidad superior.
- **Radio**: `rounded-2xl` (16px), consistente con cards y paneles `SectionBar`.
- **Sombra**: `shadow-elevation-4` (MD3 depth), sin caer en `shadow-lg` genérico.

## 3. Patrones de Uso

### Promise Toasts (`toast.promise`)
Usar para operaciones asíncronas de biblioteca, caché o descargas:

```tsx
import { toast } from "sonner";

toast.promise(syncLibraryMutation(), {
  loading: "Sincronizando biblioteca...",
  success: (data) => `Biblioteca actualizada: ${data.scanned} elementos agregados`,
  error: "Error al sincronizar con el servidor local",
});
```

### Toasts Informativos y de Éxito
- **Éxito**: Mantener conciso. Ej: `toast.success("Ajustes guardados")`.
- **Error**: Explicar el problema con lenguaje comprensible. Ej: `toast.error("No se pudo conectar al WebSocket")`.
- **Acción**: Incluir acción solo si es contextual y reversible (ej. "Deshacer").

## 4. Stacking, Z-Index y Diálogos

- **Z-Index**: El contenedor de toasts debe tener `z-[100]` para estar por encima de `Dialog` (`z-50`), `Drawer` y controles overlay del reproductor (`z-[60]`).
- **Límite visible**: Configurar `visibleToasts={3}` o `4` para evitar saturar la pantalla, especialmente en resoluciones móviles o en pantallas de televisión.
- **Animaciones**: Respetar `prefers-reduced-motion` delegando en los springs de Sonner o desactivando el deslizamiento abrupto.
