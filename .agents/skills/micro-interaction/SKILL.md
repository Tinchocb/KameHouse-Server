---
name: micro-interaction
description: Diseño e implementación de micro-interacciones táctiles y transiciones cinéticas en KameHouse con Framer Motion 12 y kinetics/.
---

# Micro-Interactions & Transitions (KameHouse Edition)

Guía para diseñar e implementar transiciones cinéticas, feedback táctil y micro-interacciones en KameHouse (`apps/web`), integrándose con `@/components/ui/kinetics` y `framer-motion@12`.

## 1. Presets Canónicos en `kinetics/`

Usar SIEMPRE las utilidades de `@/components/ui/kinetics` para garantizar consistencia física y soporte de accesibilidad:

```tsx
import { useSpringPreset, RippleFeedback } from "@/components/ui/kinetics";

// Presets disponibles:
// - "entrance": stiffness: 380, damping: 30, mass: 0.8 (modales, cards entrando, tooltips)
// - "tabIndicator": stiffness: 480, damping: 34 (indicador de tab activo con layoutId)
// - "tabContent": stiffness: 280, damping: 28 (transiciones entre paneles de tabs)
// - "cardHover": stiffness: 380, damping: 30 (hover sobre pósters o cards)
// - "press": stiffness: 520, damping: 32 (retroalimentación de pulsación)

const spring = useSpringPreset("entrance");
```

## 2. Micro-Interacciones por Componente

### Botones y Acciones
- **Pulsación (`whileTap`)**: Escala sutil `0.96` o clase `active:scale-95`.
- **Efecto Ripple**: Envolver con `<RippleFeedback>` en botones grandes o de reproducción cuando se busque feedback táctil adicional.
- **Hover**: Escala suave `1.02` sin alterar dimensiones de caja.

### Cards de Contenido (Movies / Series / Chronology)
```tsx
<motion.div
  whileHover={{ scale: 1.015, y: -2 }}
  whileTap={{ scale: 0.98 }}
  transition={useSpringPreset("cardHover")}
  className="relative rounded-2xl overflow-hidden shadow-elevation-1 hover:shadow-elevation-3 transition-shadow duration-300"
>
  {/* Contenido */}
</motion.div>
```
- **NUNCA** animar `border-width` de 1px a 2px en hover (causa repaint y jitter visual). Usar `ring` o sombra interior.

### Indicador de Tab / Segmented Control
```tsx
{isActive && (
  <motion.div
    layoutId="activeTabIndicator"
    transition={useSpringPreset("tabIndicator")}
    className="absolute inset-0 rounded-full bg-white/10"
  />
)}
```

### Chevrons y Controles Colapsables
- Rotar iconos utilizando `transform`: `transition-transform duration-200 data-[state=open]:rotate-180`.

## 3. Reglas de Oro de Rendimiento y Accesibilidad

1. **Solo propiedades del compositor**: Animar exclusivamente `transform` (`x`, `y`, `scale`, `rotate`) y `opacity`. Prohibido animar `width`, `height`, `top`, `left`, `margin` o `padding` (salvo que sea orquestado por `layout` de Framer Motion).
2. **Respeto a `prefers-reduced-motion`**: `useSpringPreset` ya conmuta automáticamente a `{ type: "tween", duration: 0.15 }`. Si se anima manualmente con CSS, incluir la variante `@media (prefers-reduced-motion: reduce)`.
3. **No encadenar animaciones bloqueantes**: Las micro-interacciones deben sentirse instantáneas e intuitivas (< 300ms), nunca retrasar la respuesta a una acción del usuario.
