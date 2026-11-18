# Continuación: retiro de proveedores de metadata

## Cambio

DynamicProvider ahora posee el ciclo de vida de los proveedores que acepta. Cada llamada delegada registra la generación que está usando, bajo un bloqueo corto que también coordina el reemplazo y el apagado. Ninguna llamada al proveedor, consulta SQL o espera de cierre se ejecuta bajo ese bloqueo.

Al reemplazar el proveedor, las llamadas nuevas pasan al nuevo. La generación anterior deja de admitir llamadas; después de que terminen las ya admitidas, una tarea de retiro llama a Close para cancelar y unir los productores que esa implementación posee. No se conserva un registro permanente de proveedores antiguos: la tarea libera su referencia al terminar.

Al apagar, se rechazan nuevas llamadas y publicaciones. Se solicita el cierre de todas las generaciones, incluidas las retiradas con llamadas todavía pendientes, y se espera tanto su Close como la devolución de sus llamadas delegadas antes de cerrar recursos compartidos. Close es idempotente y admite invocaciones concurrentes; los errores de retiros se conservan para el cierre final.

Una publicación que pierde frente al apagado conserva el último cliente TMDB aceptado y cierra el proveedor candidato rechazado. Se mantiene como operación inocua reinstalar la misma instancia activa, necesario durante la construcción inicial de la aplicación.

## Pruebas

La regresión de retiro falló antes de la corrección: el proveedor anterior nunca recibía Close después de terminar su lector. Las pruebas focales posteriores pasaron con `-count=20 -cpu=1,4,12` y cubren:

- Reemplazo mientras una consulta anterior está bloqueada, sin cancelarla durante el cambio.
- Apagado que cancela y espera proveedores retirados, además del activo.
- Espera de lectores que siguen devolviéndose después de que termine el Close concreto.
- Cien candidatos, lectores y varios cierres concurrentes: cada candidato se cierra exactamente una vez, por su propietario correspondiente.
- Reinstalación de la instancia activa y conservación de errores de cierre.
- Cleanup de la aplicación que espera un cierre ya iniciado antes de liberar recursos compartidos.
- Candidato rechazado después del cierre sin sustitución del cliente TMDB.

Verificación integrada posterior aprobada desde `apps/server`: `go test -short . ./internal/... ./codegen/...`, `go vet ./...` y `go build -buildvcs=false ./...`. La revisión de espacios con `git diff --check` también pasó para los archivos de esta continuación.

## Alcance y límites

Las llamadas de producción inspeccionadas delegan mediante DynamicProvider. GetProvider queda como snapshot de observación; usar directamente ese resultado para trabajar eludiría el registro de lectores. Los wrappers devueltos actualmente solo usan metadata en memoria.

El retiro puede cancelar productores separados de Jikan cuando ya no queda ninguna llamada delegada usando esa generación. No promete conservar ese enriquecimiento pendiente después del reemplazo. La protección frente a conflictos entre una escritura persistente antigua y una edición simultánea sigue siendo un trabajo distinto.

El apagado sigue dependiendo de que cada implementación termine sus llamadas y su Close. No establece un tiempo máximo nuevo: AniList conserva su Close vacío y sus límites HTTP existentes; TMDB puede esperar una petición compartida. Tampoco registra consultas realizadas directamente sobre snapshots del cliente TMDB.

No se reinició la instancia real ni se reemplazó su ejecutable. Las repeticiones con distintas CPU no sustituyen al detector de carreras, pendiente en este entorno.
