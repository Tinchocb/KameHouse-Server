---
name: 12-principles-of-animation
description: Auditoría y linter de animaciones web basadas en los 12 principios clásicos, adaptadas a Framer Motion y kinetics en KameHouse.
---

# 12 Principles of Animation (KameHouse Edition)

Guía y linter de motion design para auditar animaciones en KameHouse (`apps/web`), alineado con `@/components/ui/kinetics` y los contratos físicos de `docs/DESIGN-GUIDE.md`.

## 1. Reglas Adaptadas para KameHouse

Al auditar o implementar animaciones, aplicar estas reglas específicas (adaptadas para evitar conflictos con la filosofía de Emil y Jakub):

### Timing (`timing-`)
- **`timing-under-300ms`**: Toda micro-interacción iniciada por el usuario (botones, toggles, hover) debe resolverse en $\le$ 300ms.
- **`timing-consistent`**: Elementos de la misma jerarquía (ej. botones primarios vs secundarios) deben compartir la misma duración o spring.
- **`timing-stagger-fast`**: Los retardos de escalonado (stagger) en listas o grids deben ubicarse entre **30ms y 50ms** (`staggerChildren: 0.04` o `delay: index * 0.04`), evitando retardos mayores a 60ms que hagan sentir la interfaz lenta.

### Easing & Springs (`easing-`)
- **`easing-entrance-ease-out`**: Las entradas usan `ease-out` o spring `entrance` (`380/30/0.8`).
- **`easing-exit-ease-out`**: En KameHouse las salidas también utilizan `ease-out` sutil o spring amortiguado; **NUNCA** forzar `ease-in` agresivo que acelere de golpe hacia el usuario.
- **`easing-tab-glide`**: Píldoras y tabs deslizantes deben usar el spring canónico `tabIndicator` (`480/34`).

### Physics & Feedback (`physics-`)
- **`physics-scale-press`**: El feedback de pulsación (`whileTap`) debe ubicarse entre `0.95` y `0.97`. Nunca inferior a `0.95`.
- **`physics-hover-restraint`**: El hover sobre tarjetas y pósteres no debe superar `scale(1.02)`. La profundidad principal la aporta la sombra (`shadow-elevation-1` $\rightarrow$ `shadow-elevation-3`), no la escala geométrica.

### Staging (`staging-`)
- **`staging-one-focal-point`**: Solo un elemento debe atraer la atención principal al entrar (ej. en Home el `MediaSpotlight`; en Series el banner principal). No animar todos los paneles simultáneamente.

---

## 2. Formato de Hallazgos (Linter)

Reportar violaciones en formato `archivo:línea [rule-id]`:

- `src/components/ui/spotlight.tsx:142 [timing-under-300ms]`: Duración de 450ms en botón interactivo. Reducir a 200ms `ease-out`.
- `src/routes/home/index.tsx:88 [timing-stagger-fast]`: Stagger de 80ms provoca retardo percibido en la carga de tarjetas. Bajar a 40ms.
- `src/components/video/controls.tsx:55 [physics-scale-press]`: Botón de play carece de feedback `:active` o `whileTap`.
