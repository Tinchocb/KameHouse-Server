# Ajustes: revisión de persistencia — 13 de noviembre de 2026

## Seguimiento: salir a otra sección y volver

Se reprodujo específicamente la navegación SPA Ajustes → Series → Ajustes. Con Guardar manual el valor se conservaba; sin pulsarlo se perdía al desmontar el formulario. La matriz inicial no cubría este segundo recorrido.

Se añadió guardado automático antes de salir de Ajustes. La navegación espera el resultado; si falla la validación o la solicitud, se mantiene la pantalla y el borrador. Cambiar de pestaña interna conserva el formulario sin guardar todavía. Guardar manual y salir durante una solicitud comparten la misma promesa para evitar escrituras duplicadas. Este comportamiento cubre la navegación interna, no el cierre de la ventana.

`node scripts/check-settings-navigation.cjs` verifica con API aislada: guardado manual y regreso, salida sin guardado manual y regreso, y error HTTP 500 que conserva el borrador seguido de reintento exitoso. Los tres escenarios pasaron.

## Problemas confirmados y corregidos

- Al abrir Ajustes, música y sonidos priorizaban el estado local sobre el servidor. Se reprodujo con el servidor devolviendo ambos interruptores apagados y el formulario mostrándolos encendidos. Ahora se respetan también `false`, volumen `0`, carpeta vacía y lista vacía.
- Los controles de audio enviaban PATCH silenciosos aunque la barra indicara cambios pendientes. Ahora su vista previa es local y se confirma con **Guardar ajustes**; **Descartar** restaura lo guardado.
- Guardar enviaba el formulario entero. Ahora envía únicamente los valores modificados, sin IDs ni fechas administradas por el servidor. Esto evita reenviar preferencias antiguas, credenciales enmascaradas y opciones guardadas inmediatamente desde otra sección.
- La actualización desde el servidor se omitía mientras había un borrador. Ahora actualiza la base del formulario conservando sus campos modificados.
- Después de guardar se recuperan los valores canónicos de la caché de la consulta actualizada. Las ediciones realizadas durante la solicitud permanecen pendientes.
- Buscar música mantenía una segunda copia de la ruta que podía quedar obsoleta después de descartar. Ahora consulta el valor actual del formulario.

## Revisión por sección

| Sección | Opciones revisadas | Persistencia |
| --- | --- | --- |
| Apariencia | Minimalista/Por era, sagas, blur, Liquid Glass, fondo dinámico y movimiento, fondo en la ficha, blur superior, densidad de navegación, tarjeta de series, orden y puntuaciones | Formulario para preferencias de servidor; almacenamiento local para las de dispositivo |
| Reproducción | Perfiles de idioma, subtítulos doblados, intro/créditos/detección, siguiente episodio, progreso, maratón, sonidos, música, banda sonora, ambos volúmenes y carpeta musical | Guardar ajustes; vista previa inmediata |
| Biblioteca | Fuentes local/Drive, añadir/quitar carpetas, rutas completas, escaneo automático/al iniciar/unificado, proveedor, idioma y estructura estricta | PATCH inmediato; rutas completas en almacenamiento local |
| Google Drive | ID y secreto del cliente, carpeta, carga de JSON y flujo de conexión | Formulario o acciones explícitas de conexión/carpeta; pruebas existentes de la tarjeta |
| Rendimiento | Cuatro perfiles, ahorro automático, tres políticas, seis aceleradores, preset, FFmpeg y FFprobe | Guardar ajustes; perfil con vista previa |
| Sistema | Clave TMDB, ambos avisos, carpeta de caché | TMDB con debounce; avisos inmediatos; caché con Guardar carpeta |

Las acciones de escanear, analizar intros, respaldar, limpiar cachés, desconectar y restablecer son operaciones, no preferencias. Se revisaron sus rutas sin ejecutarlas sobre los datos personales.

## Verificación

- Navegador Chromium: **73 casos de controles**, ejecutados en una matriz principal de 54 y una ampliación de 19. Incluyen guardar, recargar y recuperar el valor, añadir/quitar carpetas, temas, radios, selectores, volúmenes cero y campos de texto.
- Escenarios adicionales: borrador de Reproducción junto a guardado inmediato de Biblioteca; descartar audio sin escribir; error HTTP 500 conserva el borrador y permite reintentar.
- Script reproducible: `node scripts/check-settings-persistence.cjs`. Usa API en memoria e intercepta otras mutaciones para impedir operaciones sobre datos personales. `KAMEHOUSE_SETTINGS_EXTRA_ONLY=1` ejecuta la ampliación.
- Vitest: **11 pruebas aprobadas** entre esquema, hidratación/sincronización y tarjeta de Drive. La prueba matricial recorre individualmente más de 70 campos del esquema.
- Go: pruebas `Settings|Theme` en `internal/database/db` e `internal/handlers`, y `CacheLocation|Settings` en `internal/core`, aprobadas. Estas comprueban persistencia en bases/archivos temporales, incluidos valores cero y falsos.
- TypeScript y ESLint de los archivos modificados: aprobados.

## Alcance de las comprobaciones

La API real se consultó en lectura para reproducir la discrepancia. Las pruebas de interfaz no modificaron la configuración personal. No se autorizó de nuevo una cuenta Google ni se validó la ejecución de cada GPU. FFmpeg/FFprobe siguen sujetos a las rutas permitidas por el servidor; la carpeta de caché requiere reiniciar para cambiar la ubicación en uso. No se reinició la aplicación de escritorio.
