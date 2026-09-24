# Desarrollo

## Contratos Go ⇄ TypeScript (codegen)

Los tipos y endpoints del cliente web se generan desde el servidor Go:

- Fuente: structs públicos de `apps/server/internal/**` y los comentarios
  `@route` / `@returns` / `@param` de `apps/server/internal/handlers`.
- Salida: `apps/web/src/api/generated/` (`types.ts`, `endpoints.ts`,
  `endpoint.types.ts`). **No se editan a mano.** `types.ts` es la única fuente
  de tipos; no hay splits por dominio.
- Un handler sin `@route` no aparece en `API_ENDPOINTS`: documéntalo en lugar
  de escribir la URL a mano en el cliente.

| Comando | Qué hace |
|---|---|
| `pnpm codegen` | Regenera todo. Ejecutar tras cambiar structs o handlers y commitear el resultado. |
| `pnpm codegen:check` | Regenera y falla si queda algún archivo generado modificado o sin trackear. |

Nulabilidad en `types.ts` (semántica de `encoding/json`):

| Go | TypeScript |
|---|---|
| `omitempty` / `omitzero` | `campo?: T` |
| puntero, slice, map o `json.RawMessage` sin `omitempty` | `campo: T \| null` |
| struct por valor, `time.Time`, primitivo | `campo: T` |

## Git hooks

`pnpm install` ejecuta el script `prepare`, que apunta `core.hooksPath` a
`.githooks/`. No hay dependencias extra: los hooks llaman a
`scripts/verify.mjs`.

| Hook | Comprueba |
|---|---|
| `pre-commit` | Si hay cambios en `apps/web`: typecheck + eslint de los archivos staged. Si hay `.go` staged: `go vet`. |
| `pre-push` | `vitest run`, `go test -short ./internal/... ./codegen/...` y codegen sin drift. |

`pnpm verify` ejecuta todo sobre el árbol completo. Para saltar un hook
puntualmente: `git commit --no-verify` / `git push --no-verify`.

Si `go` no está en el `PATH`, los pasos de Go se omiten con un aviso.
