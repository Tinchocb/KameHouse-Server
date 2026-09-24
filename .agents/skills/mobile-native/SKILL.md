---
name: mobile-native
description: Pautas y soluciones para experiencia móvil/PWA nativa en KameHouse (safe areas, touch targets 44px, prevención de zoom iOS, overscroll).
---

# Mobile Native & Apple Web App (KameHouse Edition)

Guía de desarrollo para lograr una experiencia fluida, táctil y de aspecto nativo en dispositivos móviles (iOS Safari, Android Chrome, PWA instalada y wrappers Tauri).

## 1. Safe Areas (Notch, Dynamic Island y Barra de Inicio)

Al utilizar `<meta name="viewport" content="..., viewport-fit=cover" />`, la interfaz se extiende por detrás del notch y de la barra de gestos de inicio.

### Reglas de Padding
- **Barras fijas superiores** (headers, navegación):
  ```tsx
  className="pt-[env(safe-area-inset-top,0px)]"
  ```
- **Barras fijas inferiores o flotantes** (`SectionBar` inferior, controles del reproductor, bottom navigation):
  ```tsx
  className="pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
  ```
- **Modales a pantalla completa**: Respetar `safe-area-inset-left` y `safe-area-inset-right` en orientación horizontal (landscape):
  ```tsx
  className="pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
  ```

## 2. Touch Targets (Regla de 44px Mínimo)

- Todo elemento interactivo (botones, tabs, chips, controles del reproductor, botones de cierre) debe tener un área táctil mínima de **44x44px**:
  ```tsx
  // Si el icono visual mide 20x20px, envolver en un contenedor con min-h / min-w:
  <button
    type="button"
    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95"
    aria-label="Cerrar modal"
  >
    <X className="w-5 h-5" />
  </button>
  ```
- No colocar dos botones interactivos pequeños a menos de 8px de distancia entre sí para evitar pulsaciones erróneas.

## 3. Prevención del Auto-Zoom en iOS

iOS Safari fuerza un zoom no deseado sobre la página si el usuario enfoca un `<input>` o `<textarea>` con tamaño de fuente menor a 16px.

- **Regla**: Todo input de texto, búsqueda o contraseña en móvil debe tener `font-size: 1rem` (`16px`) como mínimo:
  ```tsx
  // InputParts o clases Tailwind:
  className="text-base md:text-sm ..."
  ```

## 4. Touch-Action y Latencia de Toque

- Usar `touch-action: manipulation` en botones, sliders y carruseles para eliminar el retardo de 300ms del doble-tap de zoom del navegador:
  ```css
  button, [role="button"], a {
    touch-action: manipulation;
  }
  ```
- En contenedores con desplazamiento vertical (ej. listas, drawers):
  ```tsx
  className="touch-pan-y"
  ```

## 5. Prevención de Rebote y Scroll Accidental (Overscroll)

- Para modales, drawers (`Vaul`) y overlays flotantes, evitar que el scroll se propague a la página de fondo o active el pull-to-refresh del navegador:
  ```tsx
  className="overscroll-contain overflow-y-auto"
  ```

## 6. Viewport Dinámico (`dvh` en vez de `vh`)

- **NUNCA** usar `h-screen` o `100vh` en layouts móviles, ya que la barra de navegación del navegador oculta contenido inferior.
- **USAR SIEMPRE**: `min-h-[100dvh]` o `h-dvh` (`100 dynamic viewport height`).

## 7. Modo PWA Standalone

Detectar si la aplicación corre como PWA instalada para ajustar padding o navegación:

```css
@media all and (display-mode: standalone) {
  /* Ajustes específicos cuando no hay interfaz de navegador */
  .pwa-header {
    padding-top: max(env(safe-area-inset-top), 1rem);
  }
}
```
