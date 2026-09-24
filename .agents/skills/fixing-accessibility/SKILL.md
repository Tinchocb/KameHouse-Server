---
name: fixing-accessibility
description: Auditoría y corrección de accesibilidad web (a11y) en KameHouse. Reemplazo de div role="button", foco en diálogos, atributos ARIA y navegación por teclado.
---

# Fixing Accessibility (KameHouse Edition)

Guía para auditar y resolver brechas de accesibilidad (a11y) en KameHouse (`apps/web`), asegurando soporte de teclado y lectores de pantalla con cambios mínimos y sin migrar librerías.

## Regla de Oro
> **Preferir elementos HTML semánticos nativos.**
> No reescribir componentes completos: aplicar soluciones quirúrgicas y dirigidas.

---

## 1. Prioridades Críticas en KameHouse

### A. Erradicar `div role="button"`
- **Problema**: Los elementos `div` o `span` con `role="button"` carecen de soporte nativo de teclado (`Enter`, `Space`) y navegación `Tab`.
- **Casos detectados**:
  - `routes/admin/index.tsx:166,427`
  - `premium-episode-list.tsx:331`
  - `character-avatar.tsx:30`
  - `arc-cinematic-card.tsx:51`
- **Solución**:
  - Reemplazar por `<button type="button" ...>` nativo siempre que sea posible.
  - Si el layout requiere un `div` estricto, añadir `tabIndex={0}`, `onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick?.(e); }}` y `aria-label`.

### B. Gestión de Foco en Diálogos y Modales
- **Casos como `random-play-button.tsx:279 role="dialog"`**:
  - Asegurar que el diálogo atrape el foco (*focus trap*) mientras está abierto.
  - Restaurar el foco en el elemento disparador (*trigger*) al cerrarse.
  - Mantener un título accesible (`DialogTitle` o `aria-labelledby`).

### C. Formularios y Campos de Entrada
- Todo `<input>` o `<textarea>` debe contar con:
  - `aria-label` o `<label htmlFor="...">` explícito.
  - `aria-invalid={hasError}` cuando el estado de validación falle.
  - `aria-describedby` apuntando al ID del mensaje de error o texto de ayuda.

### D. Toasts y Notificaciones Asíncronas
- **Regla**: Los toasts (`sonner`) no deben ser el único canal para comunicar errores críticos de conexión o pérdida de sesión (ej. `websocket-provider.tsx:271`). Debe existir un estado visible en la interfaz o banner persistente.

---

## 2. Formato del Informe de Auditoría

Al auditar una vista o componente para a11y, reportar:

1. **Violación**: Cita exacta de la línea de código (`archivo:línea`).
2. **Impacto**: Por qué importa (ej. "Los usuarios que navegan con teclado no pueden activar este botón").
3. **Corrección concreta**: Código corregido listo para aplicar.
