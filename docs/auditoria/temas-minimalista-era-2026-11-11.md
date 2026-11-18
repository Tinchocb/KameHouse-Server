# Minimalista y Por era — 11/11/2026

## Resultado

Dos opciones visibles: Minimalista y Por era. La base compartida procedente de Neutro conserva grafito, tipografía y biseles; las siete paletas aportan acentos y tintes suaves. Minimalista conserva su contrato plano.

La normalización de preferencias se comparte entre resolución del tema, rehidratación local y Ajustes. `classic` y `advanced` se convierten a `era` + `era-universe`; el siguiente guardado persiste el formato canónico. Los valores de transparencia y Liquid Glass no se modifican. Cambiar de tema suspende los efectos en Minimalista sin sobrescribir la preferencia.

Se corrigió la prioridad CSS de las superficies Por era para que la base compartida no anule los tintes. Los paneles utilizan el token de desenfoque de 24 px; la selección del tema usa el acento sin un segundo marco luminoso.

## Validación

- Suite web completa: **212 archivos, 1560 pruebas aprobadas**.
- TypeScript, ESLint de los archivos TypeScript afectados y build de producción aprobados.
- Chromium: migración desde Neutro con efectos apagados, cambio entre temas, siete paletas, transparencia, activación de Liquid Glass y guardado/recarga. Las escrituras se interceptaron en la sesión de prueba; no se cambiaron los ajustes reales del usuario.
- Chromium: cinco lentes activas al recorrer las paletas, dentro del presupuesto de ocho. Sin desbordamiento horizontal en Inicio, Series, ficha de serie, Películas, Cronología y Ajustes.
- Chromium móvil de 390 × 844, táctil y movimiento reducido: sin desbordamiento horizontal y cambios entre los dos temas correctos.
- Capturas inspeccionadas: `tmp/theme-final-desktop.png`, `tmp/theme-era-mobile.png` y `tmp/theme-minimalista.png`. Resultados de navegador: `tmp/theme-browser-results.json`.

## Límites de la comprobación

No se reinició Tauri ni se reprodujo un video real. La revisión de reproductor y diálogos está cubierta por la suite de componentes y las recetas compartidas, sin validación visual de reproducción en esta ejecución. No se midieron FPS ni contraste de cada combinación de imagen y vidrio.


## Ampliación: paleta Negro

Se añadió `era-black` como octava paleta de Por era, con fondo negro puro, grafito y acento blanco. No sigue la serie visible ni muestra tinte ambiental, y conserva la preferencia de Liquid Glass. El selector muestra «Paleta activa» y reconoce el kanji 黒.

Validación adicional: 71 pruebas enfocadas aprobadas, TypeScript y ESLint aprobados. Chromium confirmó selección, fondo negro calculado `rgb(0, 0, 0)`, ausencia de degradado ambiental, Liquid Glass activo, guardado/recarga interceptados sin modificar los ajustes reales y permanencia de Negro al navegar a Series. Captura revisada: `tmp/theme-negro.png`.
