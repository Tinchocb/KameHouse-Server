---
name: codebase-audit
description: Auditoría estricta de calidad de código, arquitectura React 19 y deuda técnica en componentes complejos de KameHouse (read-only).
---

# Codebase Quality & Architecture Audit (KameHouse Edition)

Herramienta de inspección en **solo-lectura** orientada a diagnosticar deuda técnica, arquitectura en React 19 y salud general del código en componentes complejos o de gran volumen (ej. `SimplifiedTimeline.tsx`, `TimelineMasterView.tsx`, `player-core.ts`).

## 1. Naturaleza Read-Only

- Esta skill **NUNCA** modifica código directamente.
- Su objetivo es generar un informe estructurado, con evidencia y propuestas de refactorización priorizadas para que el equipo o el usuario decidan cuándo y cómo aplicarlas.

## 2. Ejes de Evaluación

### A. Principio de Responsabilidad Única (SRP)
- **Umbral de alerta**: Archivos de más de 350-400 líneas con múltiples responsabilidades mezcladas (renderizado visual, lógica de sincronización, polling, gestión de modales).
- **Diagnóstico**:
  - Identificar sub-componentes candidatos a ser extraídos a la carpeta `-components/` de la ruta.
  - Identificar lógica de estado o efectos candidatos a custom hooks (ej. `useTimelineNavigation`, `useStoryKeyboardNav`).

### B. React 19 & Rendimiento
- **Efectos redundantes**: Detectar `useEffect` utilizados para calcular estado derivado que podría resolverse directamente en el cuerpo del render o con `useMemo`.
- **Selectores de Zustand**: Comprobar que las suscripciones al store no consuman el objeto completo (ej. `usePlayerStore(state => state.playbackState)` en vez de `usePlayerStore()`), evitando re-renders masivos del árbol.
- **Renderizado condicional**: Evitar fragmentación de hooks detrás de condicionales tempranos (`early returns`).

### C. Prevención de Fugas de Memoria (Memory Leaks)
- **Listeners Globales**: Verificar que todo `window.addEventListener("keydown", ...)` o `"resize"` tenga su correspondiente `removeEventListener` en la función de limpieza de `useEffect`.
- **Observers**: Comprobar que `ResizeObserver` e `IntersectionObserver` invoquen `.disconnect()` al desmontar.
- **Timers y RAF**: Verificar que `setTimeout`, `setInterval` y `requestAnimationFrame` sean cancelados (`clearTimeout`, `cancelAnimationFrame`).
- **Object URLs**: Verificar que cualquier `URL.createObjectURL(blob)` ejecute `URL.revokeObjectURL(url)`.

### D. Rutas y Sincronización de Estado
- **TanStack Router**: Verificar si el estado que debe persistir en la URL (filtros, tabs, búsqueda, paginación) usa `useSearch` o `useNavigate` en lugar de `useState` efímero que se pierde al recargar.

## 3. Estructura del Informe de Auditoría

Al ejecutar una auditoría sobre un archivo o módulo, estructurar la salida de la siguiente forma:

1. **Resumen Ejecutivo**: Líneas de código, complejidad ciclomática aproximada, nivel de riesgo general.
2. **Hallazgos por Severidad**:
   - 🔴 **Alta (Blocking / Leaks / Bugs)**: Fugas de memoria, re-renders infinitos, listener leaks.
   - 🟡 **Moderada (Arquitectura / SRP)**: Componentes sobredimensionados, hooks acoplados, antipatrones de React.
   - 🟢 **Baja (Polish / Clean Code)**: Variables no utilizadas, nombres ambiguos, tipado débil (`any`).
3. **Plan de Refactorización Sugerido**: Pasos ordenados y no destructivos para sanear el componente en etapas.
