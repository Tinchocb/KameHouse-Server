# Plan de cierre del backend — 2026-11-04

Alcance: completar la validación local de las correcciones de KH-B01–KH-B17
documentadas en `backend-2026-11-04.md`, corregir regresiones demostradas y dejar
evidencia reproducible. Se preservan los cambios de web/escritorio existentes.

1. **Seguridad y compatibilidad.** Usar configuración real de producción en un
   servidor HTTP/WS efímero: origen null con/sin contraseña, Tauri, orígenes
   ajenos, preflight y `Retry-After`. Criterio: una escritura rechazada no ejecuta
   el handler y WS rechaza/acepta según origen y credenciales.
2. **Concurrencia y cierre.** Comprobar cupos de probe, cancelación de reservas
   esperando cupo, ausencia de trabajos duplicados y cierre de probes
   compartidos. Criterio: no bloqueo del manager ni admisión después del cierre.
3. **Corrección y validación.** Resolver los fallos reproducidos y ejecutar
   regresiones focalizadas repetidas con `-race`, suite completa, vet, build y
   revisión del diff. Las pruebas deben ser repetibles sin estado de otra corrida.
4. **Entrega.** Actualizar informe y registrar resultados por paso. Separar la
   validación local de TV físico, Tauri empaquetado y servicios reales. No se
   cambia la configuración del servidor del usuario ni se instala/despliega.

## Ejecución

### 1. Seguridad y compatibilidad — completado

- `TestProductionOriginPolicyHTTPAndWebSocket` usa `core.NewConfig` en modo
  production, datos temporales y las mismas funciones de CORS/guarda que monta
  `InitRoutes`. Prueba preflight, escrituras y handshakes WS mediante sockets
  locales: null/file, Tauri y origen ajeno, con/sin contraseña.
- Un contador demuestra que las escrituras rechazadas no ejecutan el handler.
  Los clientes opacos autenticados pueden conectar; los que no presentan
  credenciales reciben 401. API y WS comparten presupuesto de fallos, y el
  cliente puede leer `Retry-After: 5` por CORS cuando recibe 429.
- **Fallo reproducido y corregido:** WS comprobaba credenciales antes del
  origen. Una conexión desde un origen ajeno devolvía 401 y gastaba un intento.
  Ahora devuelve 403 antes de autenticar, sin bloquear el cupo de Tauri.
- Se rechaza el caso de DNS rebinding con Origin y Host públicos coincidentes
  sobre loopback. Los hostnames públicos legítimos requieren allowlist explícita.
- Se prueba que recargar configuración no cambia parcialmente la política de
  orígenes antes del reinicio.

Verificación focalizada: tres corridas consecutivas con `-race` de las pruebas
de origen, WebSocket y recarga CORS: PASS. Las pruebas de rate limit también
pasan en corridas repetidas después de aislar sus cachés por IP; antes se
reprodujo un fallo en la segunda corrida por estado acumulado.

### 2. Concurrencia y cierre — completado

- Ocho Enqueues simultáneos con un cupo mantienen como máximo un probe activo;
  `Jobs` sigue respondiendo y Stop cancela al productor y las reservas esperando
  cupo. Todos los Enqueues terminan y no queda un cupo tomado.
- Dos consumidores reales de `GetInfoContext` comparten un único probe. Cancelar
  al primero no cancela al productor ni perjudica al segundo. Se prueban las
  alternativas de completar/publicar caché y cerrar/cancelar sin publicarla.
- Se reutiliza la ejecución productiva de singleflight, caché, cancelación y
  cierre; solo se sustituye el proceso externo por un productor controlado.
- Se conservan las regresiones de Delete durante probe e idempotencia por hash.

Verificación: diez corridas con `-race` de cinco casos de concurrencia/cierre,
en `videofile` y `pretranscode`: PASS.

### 3. Validación global — completado

Comandos desde `apps/server`:

```powershell
go test -race ./...
go vet ./...
go build ./...
```

La salida de la suite se conserva en `backend-2026-11-04-cierre-race.log`.

Resultado final: `go test -race ./...` terminó con código 0, 43 paquetes con
pruebas y 17 sin pruebas. `go vet ./...`, `go build ./...` y
`git diff --check` sobre el alcance modificado también terminaron con código 0.

### 4. Entrega — completado

El informe principal incorpora las correcciones y estas pruebas adicionales.
Pendiente de entorno real: Tizen/WebOS físico, Tauri empaquetado, cuotas de Drive
y reproducción real. Las pruebas locales no establecen esos resultados. No se
reinició ni desplegó el servidor del usuario.
