# KameHouse Phase 3: Soporte Multi-Media y Arquitectura "Plex-Killer"

Este plan detalla la Fase 3 del desarrollo, la cual se centra en desacoplar el proyecto de AniList, introducir un sistema robusto de Colecciones/Sagas, limpiar la deuda técnica heredada y llevar la interfaz a un nivel superior (Cinemático).

## Objetivos Aprobados

### 1. Desacople Definitivo de AniList (TMDB First-Class)
- **Backend**: Abstraer el proveedor de metadatos actual. Crear interfaces (`MetadataProvider`) que permitan usar TMDB como fuente primaria de verdad para Películas y Series, limitando AniList solo para contenido catalogado explícitamente como "Anime".
- **Database**: Asegurar que el esquema SQL soporte IDs de TMDB e IMDB de manera unificada y prioritaria.

### 2. Colecciones y Sagas Nativas (El "Mejóralo")
Dado que las franquicias masivas (como Dragon Ball, Marvel, Star Wars) son difíciles de visualizar sueltas, implementaremos un sistema nativo de Colecciones de alto impacto:
- **API TMDB**: Consumir el endpoint `/collection/{collection_id}` de TMDB automáticamente cuando se detecte una película/serie que pertenezca a una saga.
- **Base de Datos**: Nuevo modelo GORM `MediaCollection` que agrupe y relacione las películas/series bajo un mismo paraguas con soporte para "Orden Cronológico" vs "Orden de Estreno".
- **Frontend (UI Cinemática)**: 
  - Nueva ruta dinámica `/collections/$id` con un diseño espectacular que domine la pantalla entera (Full Hero Background).
  - Componente `SagaSwimlane`: Una fila especial en el inicio dedicada a "Tus Sagas / Universos".
  - Componente `Timeline`: Una vista de línea de tiempo dentro de la saga para guiar al usuario sobre qué debe ver primero (Ej: ver precuelas vs ver secuelas directas).

### 3. Refactorización (Deuda Técnica)
- **Desarmar el God Object (`KameHouse` en `app.go`)**: 
  - Aplicar Inyección de Dependencias (ya tienes `google/wire`) para separar módulos (Descargas, Media, Sockets) y facilitar los test.
- **Manejo de Errores DB**: 
  - Eliminar los "silent catches", especialmente en `db.EnqueueWrite`. Loguear el fallo e inyectar un mensaje de error visual (`toast`) al frontend vía WebSocket si el escáner falla al guardar en SQLite.
- **Goroutines y Memoria**: 
  - Sellar fugas de memoria: Agregar `close()` a los canales de transcodificación (HLS) dentro de `mediastream/transcoder/stream.go` cuando el reproductor web se cierra repentinamente.

### 4. Optimización de Frontend y UI Cinemática
- **Rendimiento**: Aplicar *Code Splitting* estricto y Lazy Loading (`React.lazy`) al `VideoPlayerModal` (57KB) y `EpisodeList` (23KB). El core reproductor solo debe cargarse en RAM cuando el usuario realmente pulsa "Play".
- **Estética**: Evolucionar `hero-banner.tsx` para añadir soporte de "Video de fondo en autoplay/mute" estilo Netflix, perfeccionando los degradados glassmorphism.

---
*Nota: Multiusuario, Debrid y Watch Party quedan pausados temporalmente fuera de este sprint por decisión del sistema.*
