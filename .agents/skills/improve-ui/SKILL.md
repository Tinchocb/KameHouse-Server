---
name: improve-ui
description: Auditar una superficie de producto contra sus propios contratos de diseño (docs/DESIGN-GUIDE.md), identificar problemas comprobados y generar planes de implementación read-only.
---

# Improve UI (KameHouse Read-Only Auditor)

Audita una superficie existente contra el sistema que realmente la rige (`docs/DESIGN-GUIDE.md`, tokens en `tokens/*.css` y componentes canónicos).
Preserva la identidad visual de KameHouse y rechaza cualquier hallazgo no fundamentado en el contrato de diseño.

## Límites

- **Estrictamente read-only**: Nunca modificar código del producto durante la auditoría.
- No instalar dependencias, no formatear ni alterar el árbol de trabajo.
- Basarse en el código fuente y contratos documentados.

## Protocolo de Triple Prueba

Un candidato a problema solo se convierte en hallazgo si cumple las tres pruebas:

1. **Contract**: Cita una decisión vinculante explícita en `docs/DESIGN-GUIDE.md` o `design-system/SKILL.md` (ej. "SectionBar border rim", "springs 480/34", "no bg opaco").
2. **Runtime**: Demuestra que el código inspeccionado participa activamente en el renderizado de la vista evaluada (importaciones, JSX, props, clases aplicadas).
3. **Correction**: Especifica con precisión la corrección técnica requerida reutilizando un token, clase o componente existente (ej. reemplazar `shadow-lg` por `shadow-elevation-2`, o usar `SectionBar`).

Si la corrección requiere inventar tokens inexistentes o cambiar lógica de negocio/datos, se descarta.

## Formato del Reporte de Hallazgos

```markdown
## Lenguaje de Diseño
- Superficie auditada:
- Fuentes de diseño: `docs/DESIGN-GUIDE.md`, `tokens/*.css`
- Decisiones contractuales evaluadas:

## Hallazgos
| # | Problema | Evidencia (Archivo:Línea) | Corrección Propuesta | Ámbito | Confianza |
|---|----------|---------------------------|----------------------|--------|-----------|

## Prioridad de Mejora
<El hallazgo de mayor impacto visual/técnico y justificación de por qué atenderlo primero.>
```
