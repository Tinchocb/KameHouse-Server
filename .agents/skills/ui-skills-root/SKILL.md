---
name: ui-skills-root
description: Enrutador para seleccionar el conjunto mínimo de skills de interfaz (ui-skills y locales) antes de realizar tareas de UI/UX en KameHouse.
---

# UI Skills Root (KameHouse Router)

Capa de enrutamiento para seleccionar el contexto de skills de UI más pequeño y relevante antes de realizar tareas de interfaz en KameHouse.

Se apoya tanto en las skills curadas localmente en `.agents/skills/` como en el catálogo de `ui-skills` vía CLI.

## Protocolo

1. Determinar si la tarea es de UI/UX, arquitectura frontend o calidad de código.
2. Si no corresponde a ninguna de estas áreas, retornar `no skill needed`.
3. Identificar la necesidad concreta:
   - **Filosofía de ingeniería de diseño y taste**: usar `emil-design-eng`.
   - **Eliminación de slop, transition-all y detalles finos**: usar `make-interfaces-feel-better`.
   - **Sistema de diseño y tokens locales**: usar `design-system` (`docs/DESIGN-GUIDE.md`).
   - **Limpieza / deslop rápido visual**: usar `baseline-ui`.
   - **Auditoría UI read-only contra contrato**: usar `improve-ui`.
   - **Linter de animación y tiempos (<300ms, stagger)**: usar `12-principles-of-animation`.
   - **Accesibilidad web, teclado y ARIA (A11y)**: usar `fixing-accessibility`.
   - **Crítica estructurada por severidades (Blocking / Important / Polish)**: usar `design-review`.
   - **Notificaciones y Toasts (Sonner)**: usar `ask-sonner`.
   - **Metadata HTML, SEO, Open Graph y PWA**: usar `fixing-metadata`.
   - **Experiencia Móvil, Safe Areas y Touch 44px**: usar `mobile-native`.
   - **Micro-interacciones y Springs Framer Motion**: usar `micro-interaction`.
   - **Microcopy, tono en español y empty states**: usar `interface-copy`.
   - **Mantenimiento y sincronización de DESIGN-GUIDE.md**: usar `maintain-design-guide`.
   - **Auditoría arquitectural y calidad de código (Read-Only)**: usar `codebase-audit`.
   - **Adopción/Adaptación de componentes de Obsidian**: usar `design-system` + `emil-design-eng` (filtro obligatorio contra `docs/OBSIDIAN-MAP.md`).
   - **Búsqueda en catálogo extendido externo**: consultar `npx ui-skills list --category <categoria>`.
4. Cargar únicamente la(s) skill(s) estrictamente necesarias (máximo 1 o 2 por tarea).
5. Implementar o auditar con ese contexto.

## Reglas de Selección

- Preferir siempre 1 sola skill.
- Usar 2 solo cuando haya dos ángulos claros (ej. `design-system` + `baseline-ui`, o `micro-interaction` + `mobile-native`).
- Nunca usar más de 3 al mismo tiempo.
- No contradecir las decisiones canónicas de `docs/DESIGN-GUIDE.md` (tokens `SectionBar`, dark-first glass, springs `480/34` y `380/30`).
