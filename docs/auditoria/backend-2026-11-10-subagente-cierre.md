# Revisión de cierre: WebSockets y tareas pendientes

## Defecto reproducido y corregido

`KameHouse.Cleanup` cancelaba los trabajos pero no cerraba las conexiones WebSocket registradas. Esas conexiones pertenecen al handler tras el upgrade HTTP: `http.Server.Shutdown` y `Close` no las cierran. Un cliente conectado e inactivo dejaba su handler esperando en `ReadMessage`, incluso después de completar el cleanup de la aplicación.

La regresión `TestCleanupClosesHijackedWebSockets` abrió una conexión real contra un servidor HTTP temporal y falló antes del cambio con `cleanup left hijacked websocket handler reading`. No accede a la instancia personal ni a SQLite.

- Se agregó `WSEventManager.Close`, idempotente y seguro ante llamadas concurrentes mediante `sync.Once`.
- El cierre bloquea nuevas admisiones, vacía el registro y cierra los transports fuera del lock del registro y sin adquirir el lock de escritura de cada conexión. Esto desbloquea tanto lectores como escritores pendientes.
- `KameHouse.cleanup` lo invoca inmediatamente después de cancelar su contexto, antes de esperar tareas o cerrar almacenamiento.
- `AddConn` cierra y rechaza conexiones que terminan su upgrade después del cierre o de la cancelación del contexto. El contrato del método permanece intacto; el handler existente sale cuando falla su lectura sobre la conexión cerrada.

No se eliminaron funcionalidades activas ni se cambiaron rutas, tipos persistidos o mensajes WebSocket. `TriggerShutdown` conserva su comportamiento.

## Regresiones y validación

Pruebas nuevas:

- Cierre completo de la aplicación con un WebSocket inactivo y handler bloqueado en lectura.
- Doce llamadas concurrentes a `Close`, con el mutex de escritura retenido, sin bloqueo ni doble cierre del registro.
- Rechazo y cierre de registros tardíos tras `Close` y tras cancelación del contexto.
- Carrera entre doce registros y el cierre: ningún registro ni socket queda abierto.
- Las comprobaciones de socket distinguen cierre real de timeout, para no aceptar un timeout como éxito.

`go test ./internal/events ./internal/core -count=1 -timeout 90s` pasó; `git diff --check` sobre los archivos de esta tarea también pasó.

La comprobación ampliada `go test . ./internal/mediastream ./internal/mediastream/pretranscode ./internal/mediastream/cassette -short -count=1 -timeout 120s` pasó en raíz, pretranscode y cassette, pero falló en la regresión preexistente `TestDriveWindowReadsOnlyTheRequestedPart`: registró 106816575 bytes leídos frente a un archivo sintético de 106079908 bytes. Este lote no modifica ventanas Drive ni ese test; el resultado se comunicó al coordinador para su validación conjunta y no se declara aprobada esa suite.

La pasada también inspeccionó el orden de cleanup de `main`, el registro de trabajos del repositorio multimedia, sus regresiones de fuentes Drive pendientes/activas y el cierre de probes en pretranscode. Esos mecanismos ya tenían correcciones y pruebas de pasadas anteriores; no se les atribuyen cambios nuevos.

## Límites

Las pruebas WebSocket usan TCP local y clientes sintéticos. No se ejecutaron Desktop, TV, proveedores reales ni apagados de la instancia personal. No se ejecutó detector de carreras: el entorno mantiene CGO deshabilitado y no dispone de compilador C compatible. No se hicieron mediciones de rendimiento porque esta corrección resuelve propiedad y liberación de recursos.

El bridge del dispatcher sale por el contexto de apagado. Con el dispatcher actual su canal se cierra en su propio `Unsubscribe`; no hay una operación externa de cierre global del bus. Por tanto no se introdujo una reestructuración del bridge basada en el supuesto de un cierre externo. Si se añade ese lifecycle al dispatcher, habrá que contemplar recepción con `ok` y espera explícita del bridge.

No se reinició la aplicación, no se modificaron datos personales y no se hizo commit, push ni despliegue.
