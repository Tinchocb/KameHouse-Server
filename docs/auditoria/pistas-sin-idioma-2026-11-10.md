# Pistas sin idioma: continuación del 10 de noviembre de 2026

## Cambios de esta continuación

- El manifiesto HLS en vivo (`cassette/playlist.go`) deja de usar `und`, títulos vacíos o `unknown` como nombre visible. Usa `Audio N`, numerado por posición de la pista, conservando los índices originales en las URLs y los metadatos de idioma.
- El pretranscodificado usa el mismo helper para descartar títulos de idioma indefinido. Los títulos reales se conservan; se neutralizan comillas y saltos de línea al escribir el atributo HLS.
- El cliente también descarta títulos como `UND-Latn` y `unknown_US`, sin perder títulos reales como `- Español -`.
- Se añadieron pruebas de nombres en ambos manifiestos, de índices de contenedor no consecutivos y de títulos reales. Se ampliaron los casos del helper del cliente.

## Validación

- `go test -short ./internal/mediastream/cassette ./internal/mediastream/pretranscode ./internal/mediastream/videofile`: pasa.
- `go vet` de esos tres paquetes: pasa.
- TypeScript y ESLint de los helpers del cliente: pasan.
- Pruebas dirigidas de etiquetas y `SubtitleSettings`: 21 tests pasan.
- Suite completa del frontend, repetida con el código estable: 204 archivos y 1513 tests pasan.
- `lint:tokens`: cuatro problemas actuales en `library-empty-state.tsx` y `-google-drive-card.tsx`, archivos que esta continuación no modifica.

## Alcance y límites

El usuario recuerda que sucedió en Dragon Ball, pero no el episodio ni el origen del archivo. No se reprodujo un episodio de la biblioteca real ni se inició el servidor contra sus datos. Las pruebas del panel usan metadatos simulados y las de manifiestos ejercitan los generadores reales de Go.

Se conservaron los cambios previos del árbol. No se hizo commit, push ni instalación. `pretranscode.go` contiene cambios anteriores ajenos a esta continuación; cualquier commit debe seleccionar los hunks correspondientes.
