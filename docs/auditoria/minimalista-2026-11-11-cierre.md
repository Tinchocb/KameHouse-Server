# Cierre de Minimalista — 11/11/2026

## Resultado

Acabado plano y discreto: superficies sólidas, selección tenue con texto claro, tarjetas y hero sin sombras exteriores y perfil de movimiento de 160/180 ms sin rebote. Se preservan el arte, las composiciones, las funciones, Por era y su paleta Negro.

### Navegación y búsqueda

La franja superior de Minimalista usa layout normal desde 768 px; conserva cinco destinos con nombre y herramientas de 44 px. La marca muestra símbolo entre 768–1023 px y nombre desde 1024 px. La búsqueda se superpone sin empujar los destinos; los destinos cubiertos quedan inertes y ocultos a lectores de pantalla. Escape restaura foco e interacción. La navegación inferior móvil conserva safe areas.

Se corrigió el orden de hooks al entrar/salir de pantalla completa y el reinicio del estado transitorio de búsqueda al cambiar de ruta, tamaño o shell. Los motores de música y el selector aleatorio solo se montan en la rama activa.

### Materiales, preferencias y movimiento

Las recetas compartidas de Minimalista retiran sombras exteriores de tarjetas y hero y usan rellenos de selección tenues. Las ayudas de controles de vidrio siguen legibles, con los interruptores deshabilitados. No se modifican las preferencias guardadas para Por era.

El perfil Kinetics reacciona a cambios de tema: feedback de 160 ms, entradas/cambios de 180 ms y movimiento reducido inmediato. Las tarjetas no se elevan y usan pulsación 0.98. Los consumidores directos de motion de sagas y películas se suscriben al tema; la transición de navegación y búsqueda respeta el perfil. TV conserva su perfil anterior. El icono decorativo del inspector queda monocromo sin desaturar las imágenes. También se corrigió el orden de hooks de MovieCard al pasar de datos incompletos a una película disponible.

## Verificación realizada

- Suite global: **1582 pruebas aprobadas, 214 archivos**. Incluye regresiones de fullscreen, navegación, búsqueda, materiales, movimiento, preferencias, reproductor y menús.
- TypeScript y build de producción aprobados. Lint global aprobado, tras corregir el hook condicional de MovieCard que detectó.
- Regresión real de rectángulos de navegación y búsqueda: **768, 820, 1024, 1440 y 1920 px**, sin superposiciones entre marca, destinos y herramientas; cierre con Escape y retorno de foco correctos.
- Inicio, Series, Películas, Cronología, Ajustes y Administración: comprobaciones a **360, 390, 768, 820, 1024, 1440 y 1920 px**, sin desbordamiento horizontal involuntario, backdrop-filter ni lentes Liquid Glass.
- Estantería, ficha de serie, cronología compacta e inspector; Mi Lista y Acciones rápidas; los cinco paneles de Ajustes. Revisados con biblioteca real y sin guardar ajustes.
- Estados vacío, error y carga de Inicio: datos interceptados en una sesión aislada, sin cambiar la biblioteca real.
- Contraste de texto sobre la superficie elevada: principal **15,91:1**, secundario **9,57:1**, atenuado **6,05:1**. Estos valores no certifican cada combinación de texto sobre imágenes.
- Redistribución equivalente a zoom del 200 %: viewport CSS de 720 × 500 y escala 2, sin desbordamiento de página.
- Reproducción real en Chromium: video listo (readyState 4), tiempo avanzando, sin error del elemento de video; panel Más opciones con Audio, Subtítulos, Calidad y fuente, Imagen y Reproducción. Las escrituras de continuidad se interceptaron en la sesión de prueba.
- Tauri/WebView2: documento recargado, vista previa de Minimalista con la nueva franja y posterior recarga de las preferencias guardadas. No se guardó el cambio de tema. Evidencia visual en la conversación.

## Repetir la regresión visual

Con el frontend/API en ejecución y las herramientas locales `playwright-core` y Chrome disponibles:

```powershell
node scripts/check-minimalist-browser.cjs
```

Admite `KAMEHOUSE_WEB_URL` y `CHROME_PATH`. Intercepta la configuración para aplicar Minimalista solo en la sesión de prueba y bloquea su guardado. Conserva resultados y capturas en `tmp/minimalist-closure/`.

## Límites de la comprobación

No se reinició el proceso nativo de Tauri: la comprobación de WebView2 usó una recarga de documento en la ventana existente. No se probaron un televisor físico, un mando físico, reproducción externa en mpv ni cada combinación de codec, idioma y biblioteca. Las capturas cubren las vistas indicadas; la cobertura de componentes no sustituye la comprobación visual de cada estado posible.
