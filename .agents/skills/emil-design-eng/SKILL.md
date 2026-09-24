---
name: emil-design-eng
description: Filosofía de ingeniería de diseño de Emil Kowalski adaptada a KameHouse. Decisiones de animación, feedback táctil, HW-acceleration y detalles invisibles.
---

# Emil Kowalski — Design Engineering (KameHouse Edition)

Paraguas filosófico y técnico para elevar la calidad de las interfaces de KameHouse (`apps/web`), alineado a `framer-motion@12`, tokens de `docs/DESIGN-GUIDE.md` y `@/components/ui/kinetics`.

## 1. Filosofía Central

- **Los detalles invisibles se acumulan**: Cuando una interacción responde con la física esperada, el usuario no piensa en el código, simplemente disfruta la experiencia cinemática.
- **La belleza como ventaja competitiva**: Los buenos valores por defecto y las animaciones pulidas marcan la diferencia entre un reproductor genérico y una experiencia de cine en casa.
- **Taste is trained**: Analizar sistemáticamente por qué una transición funciona (frecuencia de uso, tiempo de respuesta, aceleración por hardware).

## 2. Formato de Review Obligatorio

Al auditar o proponer mejoras de UI, usar **estrictamente** una tabla Markdown con las columnas `Before | After | Why`:

| Before | After | Why |
| --- | --- | --- |
| `transition: all 300ms` | `transition: transform 200ms ease-out, opacity 200ms ease-out` | Especificar propiedades exactas; evitar `all` para prevenir repaints |
| `transform: scale(0)` | `transform: scale(0.96); opacity: 0` | En el mundo real nada surge de escala cero; transicionar desde escala cercana |
| `ease-in` en dropdowns | `ease-out` con spring canónico | `ease-in` se siente lento y torpe; `ease-out` brinda respuesta instantánea |
| Sin feedback en `:active` | `active:scale-95` o `scale 0.96` | Los botones interactivos deben acusar recibo táctil |
| `transform-origin: center` en popover | `transform-origin: var(--radix-popover-content-transform-origin)` | Los popovers deben escalar desde su trigger de anclaje (modales sí quedan centrados) |
| Animación de `height/width` | `clip-path: inset(...)` o FLIP layoutId | Animar dimensiones detona reflows masivos; `clip-path` y FLIP son GPU-friendly |

## 3. Framework de Decisión de Animación

1. **Frecuencia de Uso**:
   - **100+ veces/día** (atajos de teclado, navegación en lista rápida): **Cero animación** (inmediato).
   - **Decenas de veces/día** (hover en cards, tabs): Micro-escalas (`scale: 1.015`) o transiciones ultracortas (100–150ms).
   - **Ocasional** (modales, drawers, diálogos): Animación estándar con spring canónico (`entrance 380/30`).
   - **Rara** (onboarding, confirmaciones destructivas): Feedback visual extendido (`HoldConfirm`).

2. **Propósito**:
   - Toda animación debe cumplir al menos una función: **foco** (dónde mirar), **feedback** (recibí la acción), **orientación** (de dónde vino) o **delicia** (micro-física en momentos clave).

3. **Easing & Duración**:
   - **Regla de oro de duración**: Menos de **300ms** para cualquier UI interactiva.
   - **Entradas**: Siempre `ease-out` o springs sub-amortiguados. Nunca `ease-in` (se siente lento al inicio).
   - **Curva CSS canónica**: `cubic-bezier(0.23, 1, 0.32, 1)` (arranque instantáneo y frenado suave sin rebote artificial).

4. **Gestos y Física**:
   - **Velocidad de descarte**: Si `velocity > 0.11`, completar la acción (dismiss/swipe) aunque no haya cruzado el 50% de distancia.
   - **Pointer capture**: En arrastres continuos (sliders, swipe-reveal), capturar el puntero (`setPointerCapture`) para no perder el gesto fuera de la ventana.
   - **Fricción y Rubber-band**: Al sobrepasar límites, aplicar resistencia logarítmica antes del snap-back.

## 4. Rendimiento y Plataformas (TV, Desktop, Móvil)

1. **Aceleración por Hardware (GPU)**:
   - Animar **exclusivamente** propiedades del compositor: `transform` y `opacity`.
   - Cero animación en `margin`, `padding`, `top`, `left`, `width`, `height`.
   - Para reveals y paneles colapsables: usar `clip-path: inset(0 0 0 0)` o `framer-motion` `layoutId` (FLIP).
   - CSS/WAAPI para animaciones pasivas o decorativas; `framer-motion` para gestos, drag y FLIP interactivo.

2. **Aislamiento de Plataforma**:
   - **Mouse vs Touch/TV**: Aislar efectos magnéticos y hover bajo `@media (hover: hover) and (pointer: fine)`.
   - **Accesibilidad y TV**: En navegación por teclado o D-pad, asegurar `:focus-visible` inmediato y nítido sin depender de coordenadas de cursor.
   - **Touch target**: Mínimo 44px de área táctil (`min-h-[44px] min-w-[44px]`).
   - **Reduced Motion**: Si `useReducedMotion()` es activo, degradar a transiciones `tween` de 150ms o corte inmediato.

3. **Escalas Táctiles Unificadas**:
   - Rango canónico en KameHouse: `active:scale-95` a `scale(0.97)`. Nunca usar escalas menores a `0.95`.
