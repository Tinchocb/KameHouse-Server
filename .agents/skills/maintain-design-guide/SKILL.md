---
name: maintain-design-guide
description: Pautas para sincronizar, auditar y actualizar docs/DESIGN-GUIDE.md con el código real de KameHouse evitando drift documental.
---

# Maintain Design Guide (KameHouse Edition)

Protocolo para sincronizar, auditar y mantener actualizado `docs/DESIGN-GUIDE.md` como la única fuente de la verdad de diseño en KameHouse, evitando discrepancias ("drift") entre el código y la documentación.

## 1. Principio Fundamental

`docs/DESIGN-GUIDE.md` no es una lista de deseos ni una maqueta aspiracional: **es un contrato estricto reflejado en el código**.

- Si un token cambia en `apps/web/src/styles/tokens/*.css`, DEBE actualizarse la sección correspondiente en `docs/DESIGN-GUIDE.md`.
- Si se introduce un nuevo patrón de UI (ej. variante de `SectionBar`, nuevo modal o anatomía de input), DEBE registrarse con su firma exacta y clases CSS.
- Si una clase o componente queda obsoleto (`@deprecated`), DEBE marcarse en la guía y programar su remoción.

## 2. Puntos Críticos de Sincronización

### 1. Tokens de Sombras y Bordes (`§3.1`)
- **Archivo de código**: `apps/web/src/styles/tokens/shadows.css`.
- **Valores clave**:
  - `--sectionbar-border`: `rgba(255, 255, 255, 0.15)`
  - `--sectionbar-border-top`: `rgba(255, 255, 255, 0.35)`
  - `--sectionbar-border-bottom`: `rgba(255, 255, 255, 0.10)`
  - `--sectionbar-bg`: `rgba(20, 20, 25, 0.45)` (o `0.85` en modo flotante)
  - Variantes strong: `border: 0.22`, `top: 0.45`, `bottom: 0.15`.
  - Elevation tokens: `--elevation-1` a `--elevation-5`.

### 2. Tipografía y Fuentes (`§4`)
- **Outfit**: `font-display` (títulos, encabezados, modales).
- **Inter / Sans**: `font-sans` (cuerpo, labels, descripciones).
- **Space Mono**: `font-mono` (códigos técnicos, contadores, timestamps, `tabular-nums`).

### 3. Escala Canónica de Radios
- `rounded-full`: Pills, tabs activos, inputs, botones de acción circular.
- `rounded-xl`: Sub-filas internas, items de menú desplegable, botones de sidebar.
- `rounded-2xl`: Paneles `SectionBar`, cards de contenido, modales.
- `rounded-3xl`: Hero spotlights, contenedores principales envolventes.
- *Cualquier radio intermedio (ej. `rounded-lg` arbitrario) debe ser justificado o unificado a esta escala.*

### 4. Kinetics y Springs (`§5`)
- **Archivo de código**: `apps/web/src/components/ui/kinetics/hooks.ts`.
- Verificar que los presets documentados coincidan con:
  - `entrance`: `380/30`
  - `tabIndicator`: `480/34`
  - `tabContent`: `280/28`
  - `cardHover`: `380/30`
  - `press`: `520/32`

## 3. Procedimiento para Actualizar `DESIGN-GUIDE.md`

1. **Auditar el código primero**: Leer el archivo CSS o TypeScript de referencia antes de editar la guía.
2. **Citar rutas relativas exactas**: Indicar siempre el archivo fuente (ej. `apps/web/src/styles/tokens/shadows.css:79-94`).
3. **No inventar tokens**: Nunca documentar una variable que no esté declarada en los archivos de tokens de `apps/web/src/styles/tokens/`.
4. **Verificar consistencia**: Tras modificar la guía, ejecutar búsqueda global (`grep_search`) para asegurar que no queden referencias desactualizadas.
