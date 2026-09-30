# Pendientes

Estado al 29/09/2026. Lo que la revisión de código y la auditoría de diseño dejaron sin hacer, con el motivo.
Lo ya corregido está en el historial de git (`git log --oneline`).

## Decisiones tuyas

- **Rama.** `feat/cronologia-alternada` ya no describe su contenido (seguridad, streaming, refactors, diseño). Existe en `origin`; renombrarla implica publicar una rama nueva. Ninguno de los commits locales se subió.

## Diseño (de la auditoría de interfaz)

- **`ViewModeTabs` → `SegmentedControl`** (`routes/series/-ViewModeTabs.tsx`). No es una limpieza: hoy usa tipografía sans extrabold y el canónico usa mono bold, y el canónico dibuja siempre la sombra pesada, mientras que `ViewModeTabs` la apaga según el nivel de rendimiento (`allowEraFx`). Para migrar sin regresión hay que extender `SegmentedControl` (por ejemplo una prop `disableEffects` y una variante de tipografía). Toca la cabecera de Series: acordar antes.
- **Botones de Administración → `Button`.** El informe pedía cambiar `rounded-button` por `rounded-pill`, pero `--radius-button` ya vale `var(--radius-full)`: es el mismo radio. Migrar a `Button` (`outlined`, `sm`) sí cambia el estilo (mayúsculas `font-black`, texto de acento). Decidir si se quiere ese cambio visual.
- **`text-balance`** en títulos de películas y descripciones de sagas. Es pulido subjetivo y necesita ojo de diseño para juzgar el resultado en anchos intermedios.
- **Botones de la barra flotante** (`floating-pill-nav`): miden 32-34 px, por debajo de los 44 px de la guía. No estaban en el informe; se dejaron porque viven dentro de una píldora compacta.
- **`lucide-react` importado directo** en `components/chronology/` (10 archivos) en vez de `@/components/ui/icons`. Ojo: `IconMediaShuffle` es `ArrowLeftRight`, no `Shuffle`; para conservar el dibujo se agregó `IconMediaRandom`. Revisar ícono por ícono antes de migrar.
- **Hero de Películas y otros fondos**: ver `docs/IMAGENES-PENDIENTES.md`.

## Seguridad y servidor

- **`Host` sin validar en lecturas (GET).** La guarda de `Origin` protege las escrituras; un ataque de DNS rebinding todavía podría leer respuestas sin credenciales. Riesgo menor porque el CORS ya limita las lecturas con credenciales. Se arregla validando `Host` (IP, `localhost`, `.local` o un origen permitido).
- **`music/scan` y `music/stream`** (LAN sin contraseña) sirven audio de cualquier carpeta que no sea de sistema. Solo audio y sin escrituras; considerar limitarlo a una carpeta configurada.
- **`quic-go` 0.57.1** con un aviso conocido que el código no llama. Actualizar a 0.59 rompe `imroc/req/v3`; reintentar cuando esa librería lo soporte.
- **`golang.org/x/crypto`**: aviso sin versión corregida publicada.
- **`codegen/`**: 63 avisos de `errcheck` (escritura de texto a archivos en una herramienta de desarrollo). Se dejan a propósito.
- **Rust**: `quick-xml` 0.39.4 (solo lo trae `wayland-scanner`, Linux) y `rkyv` (no entra en el grafo). No afectan a la app de Windows.
- **App de escritorio empaquetada**: los orígenes `tauri.localhost` y `tauri://localhost` se agregaron a la lista permitida (antes el servidor los rechazaba con el entorno de producción del sidecar). Se verificó la respuesta del servidor con `curl`, pero **no se probó el `.exe` empaquetado**: conviene una pasada real con `pnpm build:desktop`.

## Calidad

- **`usePlayerSkip.ts`** sigue en 721 líneas: el resto es cableado de estado y efectos con muchos refs. Ya tiene 16 tests de integración que sirven de red para seguir dividiéndolo.
- **`getting-started`, series y otros archivos grandes**: `matroska/parser.go`, `getting-started.tsx` y la ruta de Series ya se dividieron. Quedan candidatos: `usePlayerSkip.ts` (721), `upath.ts` (841), `handlers/mediastream.go` (934), `cassette/pipeline.go` (940), `database/db/db.go` (1028).
