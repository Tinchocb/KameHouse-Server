---
name: make-interfaces-feel-better
description: Principios de ingeniería de diseño de Jakub Krehel adaptados a KameHouse. Eliminación de transition-all, tabular-nums, text-balance, radios concéntricos y detalles que elevan la interfaz.
---

# Make Interfaces Feel Better (KameHouse Edition)

Colección de principios de ingeniería de diseño para eliminar el "slop" y resolver la deuda de pulido visual en KameHouse (`apps/web`).

## Regla Fundamental del Sistema de Estilos
> **NUNCA introducir un segundo sistema de diseño ni librerías adicionales.**
> Todas las soluciones deben expresarse en el stack nativo de KameHouse: **Tailwind 3.4 + tokens SectionBar (`docs/DESIGN-GUIDE.md`) + Radix UI + Framer Motion 12**.

---

## 1. Principios Clave Mapeados a KameHouse

### A. Erradicar el Abuso de `transition-all`
- **Problema**: `transition-all` interpola propiedades no aceleradas por GPU (`background-color`, `border-color`, `height`, `padding`), causando repaints innecesarios.
- **Regla**: Especificar la propiedad exacta:
  - Cambios de color: `transition-colors duration-200`
  - Escalas o movimiento: `transition-transform duration-200 ease-out`
  - Desvanecimientos: `transition-opacity duration-200`
  - Sombras: `transition-shadow duration-300`

### B. `tabular-nums` en Timers, Contadores y Estadísticas
- **Problema**: Números que cambian (reproductor de video, progreso de episodios, contadores de sagas) provocan *layout shift* horizontal si usan fuentes proporcionales.
- **Regla**: Aplicar siempre `font-mono tabular-nums` o la clase `tabular-nums` de Tailwind en cualquier valor numérico dinámico.

### C. `text-wrap: balance` en Encabezados y Títulos
- **Problema**: Títulos de episodios, películas o paneles con palabras huérfanas en líneas finales.
- **Regla**: Aplicar `text-balance` en todos los títulos principales (`h1`, `h2`, `h3`, `font-display`).
- **Cuerpo**: Aplicar `text-pretty` en párrafos descriptivos y sinopsis.

### D. Radios Concéntricos
- **Fórmula**: $\text{Radio exterior} = \text{Radio interior} + \text{Padding}$.
- **Ejemplo**: Si un contenedor `SectionBar` tiene `rounded-2xl` (16px) y padding de `p-2` (8px), los elementos internos hijos deben usar `rounded-xl` o `rounded-lg` (8px), no `rounded-2xl` idéntico.

### E. Alineación Óptica de Iconos
- Iconos asimétricos (como el triángulo de "Play") requieren compensación óptica: un padding izquierdo de `pl-0.5` o `translate-x-[1px]` para que se perciba centrado dentro de un botón circular.

### F. Sombras para Elevación, Bordes para Estructura
- Mantener bordes claros para delimitar estructura (`border-white/15`, `border-t-white/35`).
- Usar elevaciones MD3 (`shadow-elevation-1..5`) para dar sensación de profundidad y separación de planos.

### G. Auditoría de `will-change`
- **Regla**: No colocar `will-change` de forma preventiva o desmedida. Eliminar `will-change-opacity` innecesarios; reservar `transform-gpu` únicamente para elementos en movimiento continuo (como orbes de aura ambiental o backdrops cinemáticos).

---

## 2. Formato de Auditoría Obligatorio

Al auditar cualquier componente o vista, generar un informe con la estructura:

| Severidad | Ubicación | Before | After | Why |
|---|---|---|---|---|
| 🟡 Polish | `src/routes/series/...` | `transition-all duration-200` | `transition-colors duration-200` | Evita recalcular layout y previene repaints |
| 🟡 Polish | `src/components/video/...` | `<span className="font-mono">{time}</span>` | `<span className="font-mono tabular-nums">{time}</span>` | Elimina el jitter y layout shift por números de ancho variable |
| 🟡 Polish | `src/components/ui/...` | `<h2 className="font-display text-2xl">{title}</h2>` | `<h2 className="font-display text-2xl text-balance">{title}</h2>` | Distribución tipográfica armónica sin palabras huérfanas |
