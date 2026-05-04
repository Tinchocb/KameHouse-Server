# KameHouse Backend — Instructivo Completo

> Última auditoría: 25 Mar 2026

## Visión General

Servidor Go 1.24 que funciona como backend de una plataforma de streaming de anime/media. Fork personalizado de [Seanime](https://github.com/5rahim/seanime) renombrado a "KameHouse".

## Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Lenguaje | Go 1.24 |
| HTTP Framework | Echo v4.15 |
| Base de Datos | SQLite via GORM + glebarez/sqlite |
| Logging | zerolog + lecho (Echo adapter) |
| Config | Viper (TOML) + env vars + .env (gotenv) |
| Torrents | anacrolix/torrent (P2P nativo) |
| Video | FFmpeg/FFprobe (goffmpeg + go-ffprobe) |
| WebSocket | gorilla/websocket |
| Concurrencia | sourcegraph/conc, golang.org/x/sync |

## Estructura del Proyecto

```
apps/server/
├── main.go                 # Entry point: señales OS, Echo, graceful shutdown
├── go.mod                  # Go 1.24, ~48 deps directas
├── internal/
│   ├── core/               # ⭐ Corazón de la app
│   │   ├── app.go          # KameHouse struct (God Object, ~40 campos)
│   │   ├── config.go       # Config via Viper, validación, defaults
│   │   ├── modules.go      # initModulesOnce + InitOrRefreshModules
│   │   ├── echo.go         # Echo setup + SPA embedded
│   │   ├── feature_flags.go # Feature toggles (lógica dispersa, sin abstracción)
│   │   ├── resolver.go     # ⭐ Dependency Injection & Service Resolver (~9KB)
│   │   ├── offline.go      # Modo offline nativo
│   │   ├── flags.go        # CLI flags
│   │   ├── hmac_auth.go    # Autenticación HMAC
│   │   ├── watcher.go      # File system watcher
│   │   └── wire.go         # Dependencias via google/wire
│   ├── handlers/           # ⭐ 53 archivos de handlers HTTP
│   │   ├── routes.go       # InitRoutes: 100+ endpoints bajo /api/v1
│   │   ├── server_auth_middleware.go
│   │   ├── server_features_middleware.go
│   │   ├── trace_middleware.go
│   │   └── proxy.go        # ⭐ Proxy para CORS de imágenes ext.
│   ├── events/             # WebSocket Manager
│   │   └── websocket.go    # ⭐ WSEventManager (ver notas de concurrencia)
│   ├── database/
│   │   ├── db/             # GORM database wrapper + BufferedWriter
│   │   └── models/         # GORM models + DTOs
│   ├── api/                # Clientes externos (TMDB, Torrentio, MAL)
│   ├── library/            # Scanner, autodownloader, autoscanner
│   ├── library_explorer/   # Explorador interactivo para la web UI
│   ├── streaming/          # HLS transcoding pipeline
│   ├── matroska/ + mkvparser/ # Lectura binaria MKV
│   ├── pgs/                # Parser de subtítulos (SUP/PGS)
│   ├── metadata/ + metadata_provider/ # Enriquecimiento de media
│   ├── cron/               # Schedulers & jobs en segundo plano
│   ├── queue/              # Colas job-worker concurrentes
│   ├── local/              # Soporte offline real
│   ├── extension/          # Subsistema de extensiones/plugins
│   ├── hook/ + hook_resolver/ # Event lifecycle in-app
│   ├── troubleshooter/     # Diagnóstico automático
│   └── util/               # Helpers generales
└── web/                    # Embedded SPA (built frontend)
```

## Flujo de Inicialización

```
main() → signal.NotifyContext → run(ctx)
  ↓
run():
  1. loadEnvFile()              - Carga .env en CWD y dirs padre
  2. ConfigOptions{Port,Host}   - Lee env vars KAMEHOUSE_PORT/HOST
  3. core.NewKameHouse(opts)    - ⭐ Función principal de init
  4. core.NewEchoApp(app)       - Configura Echo con SPA embebido
  5. handlers.InitRoutes(app,e) - Registra 100+ rutas
  6. e.Start(addr)              - Escucha HTTP
  7. ← ctx.Done()               - Graceful shutdown (15s timeout)
```

### core.NewKameHouse() hace:

1. Logger (zerolog)
2. Hook Manager (plugin system)
3. Config (Viper TOML + env + flags)
4. Database (GORM SQLite, WAL mode)
5. TMDB Client + WebSocket Event Manager
6. Metadata Enrichers (FanArt, OMDb, OpenSubtitles)
7. File Cache + Metadata Provider
8. Local/Offline Manager + Platform (TMDB / Simulated / Offline)
9. Continuity Manager + VideoCore + Thumbnail Cache
10. **`shutdownCtx`** — Contexto de ciclo de vida para goroutines
11. `initModulesOnce()`: Filler, Torrent, Streaming, MediaStream, DirectStream, TorrentStream, AutoDownloader, AutoScanner, LibraryExplorer
12. `InitOrRefreshModules()`: Refresh dependiente de Settings
13. Init de Mediastream/Torrentstream settings

## Seguridad — Middleware Pipeline

Todos los requests bajo `/api/v1` atraviesan:
1. **TraceMiddleware** (`trace_middleware.go`) — Logging de latencia y telemetría.
2. **AuthMiddleware** (`server_auth_middleware.go`) — Validación HMAC o cookie de sesión.
3. **FeaturesMiddleware** (`server_features_middleware.go`) — Feature gating (offline/online).

## Handler Pattern

```go
type Handler struct { App *core.App }

func (h *Handler) HandleXxx(c echo.Context) error {
    // Parse → h.App.SomeService.Method() → RespondWithData / RespondWithError
}
```

Respuestas siguen siempre: `{ "data": T }` o `{ "error": "string" }`.

## API Routes

| Grupo | Ejemplo | Estado |
|---|---|---|
| Status/Home | `/status`, `/home/curated` | ✅ Funcional |
| Library | `/library/scan`, `/library/collection` | ✅ Funcional |
| Streaming | `/stream/:id/master.m3u8`, `/directstream/*` | ✅ Funcional |
| Torrentio | `/torrentio/streams` | ✅ Funcional |
| Settings | `/settings`, `/theme` | ✅ Funcional |
| Continuity | `/continuity/item`, `/continuity/history` | ✅ Funcional |
| Torrent Client | `/torrent-client/*` | ⚠️ STUB |
| Debrid | `/debrid/*` | ⚠️ STUB |

## Base de Datos

- **Motor**: SQLite via GORM (WAL mode + busy_timeout=5000ms)
- **Ubicación**: `{AppDataDir}/kamehouse.db`
- **BufferedWriter**: Escrituras en batch async para reducir contención.
- **⚠️ schema.go**: Existe un schema SQL raw paralelo (media, episodes, etc.) que NO usa GORM.

## Estado de Concurrencia (Auditoría Mar 2026)

### ✅ Resuelto

| Problema | Fix aplicado |
|---|---|
| Race condition en `WSEventManager.Conns` | `connsMu sync.RWMutex` + snapshot antes de I/O |
| `AddConn`/`RemoveConn` sin protección | Ahora bajo `connsMu.Lock()` |
| `ExitIfNoConnsAsDesktopSidecar` lee Conns desde goroutine | Usa `connsMu.RLock()` |
| `SendEvent` bloquea `mu` durante I/O de red | Reemplazado por snapshot + RLock |
| Goroutines de `AutoDownloader` sin lifecycle | Ahora reciben `shutdownCtx`, se cancelan en `Cleanup()` |
| `SubscribeToClientEvents` buffer 900 | Reducido a 100 (consistente con el resto) |
| Errores de scan solo en logs | Se emite evento WebSocket `SCAN_ERROR` al cliente |

### ⚠️ Pendiente

| Problema | Severidad | Ubicación |
|---|---|---|
| Errores en `db.EnqueueWrite` silenciados | Media | `database/db/db.go:100` |
| Canales de segmentos sin `close()` explícito | Media | `mediastream/transcoder/stream.go` |
| `KameHouse` struct con 40+ campos (God Object) | Media | `core/app.go` |
| Sin rate limiting en endpoints de scan/search | Media | Global |
| Path traversal en handlers de status | Baja | `handlers/status.go:149` |
| CORS wildcard en desarrollo | Baja | `handlers/routes.go:34` |

## Tests Existentes

59 archivos `_test.go` cubriendo: API clients, database cleanup, hook system, library scanner, matroska/MKV parser, streaming, torrent autoselect, utilities.

```bash
# Ejecutar con race detector
go test -race ./internal/events/...
go test -race ./internal/core/...

# Build limpio
go build ./...   # ✅ exit 0
```

## Notas Arquitectónicas

- **God Object**: `KameHouse` centraliza todo el estado. Funciona, pero dificulta testing unitario. Candidato a descomposición en módulos en una fase futura.
- **Dependency Order**: `initModulesOnce()` tiene orden implícito de inicialización. Violarlo rompe el server silenciosamente.
- **Proxy Endpoints**: `proxy.go` bypasea CORS de TMDB sirviendo imágenes localmente — es intencional y crítico para el funcionamiento en LAN.
- **Background Asyncing**: `cron/` y `queue/` usan `sourcegraph/conc` para tolerancia a fallos en workers.
- **Extension System**: Diferente al hook system. Permite plugins externos sin modificar el core.
