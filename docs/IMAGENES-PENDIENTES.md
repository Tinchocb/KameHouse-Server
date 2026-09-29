# Imágenes pendientes (para otra sesión)

Estado al 28/09/2026. Nada de esto está descargado ni aplicado: es la lista de qué falta y dónde buscarlo.
Ningún enlace de abajo se verificó (resolución, licencia ni que la imagen exista): antes de usar una, medirla y confirmar que se puede usar.

## 1. Fondos del hero por debajo de 1440 px

Se estiran en pantallas grandes o HiDPI. Están en `apps/web/src/lib/config/hero-art.ts` (`sourceWidth`). Los comentarios del archivo dicen que TMDB solo tiene estas versiones, así que hay que salir de TMDB.

| Constante | Título | Ancho actual | Qué buscar |
|---|---|---|---|
| `DB_TRAFFIC` | Seguridad Vial de Goku (1988) | 1326 | Ilustración oficial o captura HD, sin texto, ≥1920 px |
| `DBZ_YO_GOKU` | ¡Hola! Son Goku (1993) | 1280 | Ilustración oficial, ≥1920 px. Arte con el sujeto a la derecha (`subject: "right"`) |
| `DBZ_GOKU_WORLD` | ¡Todos reunidos! El mundo de Gokú (1992) | 1280 | Arte de grupo, ≥1920 px |
| `DBZ_M9` | Película 9 | 1280 | Backdrop ≥1920 px sin texto |
| `DBGT_100` | 100 Años Después (1997) | 1440 (y borroso de origen) | Key visual o ilustración nítida, ≥1920 px |

Requisitos: sin texto ni logos, proporción cercana a 16:9, personajes claros a la derecha (el texto va a la izquierda), formato jpg/webp. Cada imagen nueva necesita su encuadre (`focal`, `subject`, `safeTop`, `tone`) y ajustar `sourceWidth`.

Fuentes a probar (sin verificar): Fanart.tv (`https://fanart.tv/movie/<TMDB_ID>/`, exige clave de API y bloquea el acceso anónimo), TheTVDB, Alpha Coders, Zerochan, y arte oficial de Toei o Bandai Namco.

## 2. Figura de Goku para DB Kai (estantería de /series)

`apps/web/src/lib/helpers/goku-panorama.ts`: `dragon_ball_kai.rawImg` usa `/icons/series-icons/goku-raw-dbz.webp`, la misma figura que DBZ. Se ven dos Goku idénticos lado a lado.

Hace falta un recorte de Goku con fondo transparente, cuerpo completo, distinto al de DBZ (por ejemplo pose de la saga de Freezer en Kai), en webp con transparencia y una altura parecida a las otras cuatro figuras de `apps/web/public/icons/series-icons/`.

## 3. Cómo aplicarlas

1. Medir el ancho real y confirmar que no tiene texto.
2. Fondos del hero: reemplazar el path en `hero-art.ts`, curar el encuadre y actualizar `sourceWidth` (o quitarlo si ya llega a 1440 px).
3. Figura de Kai: guardar en `apps/web/public/icons/series-icons/goku-raw-dbkai.webp` y apuntar `rawImg`. `SPINE_ART_URLS` se recalcula solo.
4. Comprobar en `/movies`, `/home` y `/series` con ventanas de 1440 px y de 1920 px.
