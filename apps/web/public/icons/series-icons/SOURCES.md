# Recortes de la estantería de series

Selección incorporada el 16 de octubre de 2026. Archivos originales descargados, sin generación ni modificación de las ilustraciones. Cada recorte se encuadra por separado desde CSS.

| Archivo | Uso | Fuente |
| --- | --- | --- |
| db/reposo.png | Goku niño con brazos cruzados | [Kid Goku Confident Pose — Wallpapers.com](https://wallpapers.com/png/kid-goku-confident-pose-rfml6yc5str7wa85.html) |
| dbgt/reposo-anime.png | Goku GT con brazos cruzados | [Dragon Ball Goku GT — VHV](https://www.vhv.rs/viewpic/xooRxm_dragon-ball-goku-gt-hd-png-download/) |
| dbgt/combate-ssj4.png | Goku SSJ4 en guardia | [Son Goku — PNGkit](https://www.pngkit.com/view/u2q8i1y3w7i1o0e6_son-goku-dragon-ball-gt-png/) |
| dbkai/combate-ssj.png | Goku SSJ en guardia | [Imagen publicada en VS Battles](https://vsbattles.com/threads/goku-vs-android-19-but-earlier.155270/) |
| dbkai/reposo-campera.png | Goku SSJ con campera, reposo de Kai (17 de octubre de 2026) | [Super Warrior's Day Off — Dokkan Art](https://dokkan.art/character/1026620) |
| dbkai/combate-namek.png | Goku SSJ atacando en Namek, combate de Kai (17 de octubre de 2026) | [Un coup rempli de colère — archivo Dokkan](https://dbz-dokkanbattle.com/card/1022630) |

## Archivos originales

- DB: https://wallpapers.com/images/hd/kid-goku-confident-pose-rfml6yc5str7wa85.png
- GT reposo: https://www.vhv.rs/dpng/f/87-879924_ssj4-goku-png.png
- GT combate: https://www.pngkit.com/png/full/137-1378058_goku-png.png
- Kai combate: https://pbs.twimg.com/media/FRP0fXkXwAA4u0t.png
- Kai con campera: https://dbz-dokkanbattle.com/img/character/card/1026620/card_1026620_character.png
- Kai ataque en Namek: https://dbz-dokkanbattle.com/img/character/card/1022630/card_1022630_character.png?v=1

Crédito de la imagen de Dragon Ball: Wallpapers.com (su página solicita atribución). Los enlaces registran procedencia; no constituyen una licencia de los personajes. Las poses restantes de Z, Super y Daima y el ataque de Dragon Ball ya estaban en el proyecto.

## Codificación para entrega (21 de octubre de 2026)

Se conservan los PNG fuente y sus créditos. Once poses se sirven como WebP sin pérdida; el reposo de Kai sigue en PNG porque su WebP resultó mayor. No se alteraron ilustraciones, dimensiones ni encuadres. Se verificó la igualdad del alfa y de todos los RGB con alfa distinto de cero; WebP puede descartar RGB ocultos en píxeles totalmente transparentes.

Las 12 imágenes activas pasan de 5.352.303 a 3.549.933 bytes (33,67 % menos). Esto reduce la transferencia de las imágenes activas; conservar los PNG junto a los WebP aumenta los archivos incluidos en la distribución.

Reproducción: `node scripts/optimize-shelf-art.mjs [ruta al módulo sharp]` desde la raíz del repositorio, con Sharp disponible. El script compara píxeles antes de actualizar el registro y escribe hashes, dimensiones y tamaños en `docs/auditoria/shelf-art-optimization.json`.

## Selección del 22 de octubre de 2026

DB reposo: db/reposo-salto.png (opción G). Fuente: https://dbz-dokkanbattle.com/card/1005461
Original: https://dbz-dokkanbattle.com/img/character/card/1005460/card_1005460_character.png

DB combate elegido el 22 de octubre de 2026: `db/combate-kamehameha.png` (opción 14), PNG original con transparencia. Fuente: https://www.nicepng.com/ourpic/u2w7r5q8y3t4i1w7_kamehameha-transparent-kid-goku-kid-goku-kamehameha/
Original: https://www.nicepng.com/png/full/226-2266773_kamehameha-transparent-kid-goku-kid-goku-kamehameha.png

DBZ reposo elegido el 22 de octubre de 2026: `dbz/reposo-n.png` (opción N). Referencia: https://www.hiclipart.com/free-transparent-background-png-clipart-vxoil ; vista previa: https://p1.hiclipart.com/preview/270/159/717/goku-png-clipart.jpg . Recorte con transparencia mediante herramienta integrada image_gen; no es el PNG original del sitio (descarga protegida por CAPTCHA). Prompt: quitar únicamente el fondo cuadriculado conservando dibujo, pose, colores y cuerpo completo.

DBZ combate elegido el 22 de octubre de 2026: `dbz/combate-ssj-espaldas.png`. Ilustración adjuntada por el usuario; referencia conservada en `dbz/combate-ssj-espaldas-referencia.jpg`. Fondo blanco retirado mediante image_gen integrado. Prompt: quitar únicamente fondo blanco, preservar pose de espaldas, colores y reflejos blancos interiores del cabello, cuerpo completo y botas.

DBZ reposo actualizado el 22 de octubre de 2026: `dbz/reposo-ssj.png`, Super Saiyan de pie, imagen adjuntada por el usuario. Referencia: `dbz/reposo-ssj-referencia.jpg`. Fondo retirado mediante image_gen integrado. Prompt: retirar únicamente fondo blanco, conservar cuerpo completo, pose, perspectiva, colores y sombras. Sustituye a la opción N.

DB reposo actualizado el 22 de octubre de 2026: `db/reposo-baculo.png`, imagen original adjuntada por el usuario; referencia conservada en `db/reposo-baculo-referencia.jpg`. Fondo blanco retirado preservando dibujo, ojos, emblema Kame, traje, báculo y sombreado, con transparencia completa en el contorno y huecos interiores. Sustituye la opción G.

DB reposo corregido el 22 de octubre de 2026: en `db/reposo-baculo.png` quedaba una cuña de fondo blanco opaco entre la cola, el tubo del báculo y el hombro (264 px, caja 178,761–211,808). Se hizo transparente y se suavizó el borde de 2 px sin halo; el brillo blanco del brazo, ojos, emblema, zapatos y guantes son parte del dibujo y no se tocaron.

GT reposo actualizado el 22 de octubre de 2026: `dbgt/reposo-ssj.png`. Goku GT Super Saiyan, imagen adjuntada por el usuario; original conservado en `dbgt/reposo-ssj-referencia.png`. Fondo retirado mediante image_gen integrado. Prompt: quitar únicamente fondo blanco, preservar pose, cabello, cola, ropa, cuerpo completo y colores.

GT ataque actualizado el 22 de octubre de 2026: `dbgt/combate-ssj4-kamehameha.png`. Imagen adjuntada por el usuario; original conservado en `dbgt/combate-ssj4-kamehameha-referencia.jpg`. Fondo retirado mediante image_gen integrado. Prompt: retirar únicamente fondo blanco, incluido hueco de la cola; conservar dibujo, pose, cuerpo completo, ropa y colores.

Kai reposo actualizado el 22 de octubre de 2026: `dbkai/reposo-goku.jpg`, imagen original adjuntada por el usuario. Conservada sin edición y con fondo blanco; la eliminación de fondo mediante image_gen fue rechazada por el servicio.

Kai reposo actualizado el 22 de octubre de 2026: `dbkai/reposo-espaldas.png`, Goku de espaldas adjuntado por el usuario; original en `dbkai/reposo-espaldas-referencia.jpg`. Fondo retirado mediante image_gen integrado. Prompt: quitar únicamente fondo claro, conservar pose de espaldas, cuerpo completo, colores y emblema. Sustituye a `reposo-goku.jpg`.

Kai ataque actualizado el 22 de octubre de 2026: `dbkai/combate-kamehameha.png`. Imagen adjuntada por el usuario; original conservado en `dbkai/combate-kamehameha-referencia.jpg`. Fondo retirado mediante image_gen integrado. Prompt: quitar únicamente fondo blanco, conservar pose, manos, rostro, colores, trazos y sombreado originales.

Super reposo actualizado el 22 de octubre de 2026: `dbs/reposo-god.png`, Super Saiyan God adjuntado por el usuario; original conservado en `dbs/reposo-god-referencia.jpg`. Fondo retirado mediante image_gen integrado. Prompt: quitar únicamente fondo blanco, conservar pose de pie, cuerpo completo, colores, sombreado y marca del artista.

Super ataque actualizado el 22 de octubre de 2026: `dbs/combate-ultra-instinto.png`. Imagen adjuntada por el usuario; original conservado en `dbs/combate-ultra-instinto-referencia.jpg`. Fondo retirado mediante image_gen integrado. Prompt: quitar únicamente fondo blanco, preservar pose de combate, cuerpo completo, colores, cabello y sombreado.

Daima reposo actualizado el 22 de octubre de 2026: `daima/reposo.png`, Goku Mini volando hacia el frente, imagen adjuntada por el usuario; original conservado en `daima/reposo-referencia.jpg`. Fondo blanco retirado con preservación de ojos, cinta, sombras y bordes suaves anti-alias sin halo blanco. Sustituye a `reposo-baculo.jpg`.

Selección del usuario, 22 de octubre de 2026: `/icons/series-icons/db/reposo-guardia.png`; referencia JPG conservada junto al PNG. Fondo retirado mediante image_gen integrado. Prompt: quitar únicamente fondo claro conservando dibujo, pose, colores, cuerpo completo y marcas de autor existentes.

Selección del usuario, 22 de octubre de 2026: `/icons/series-icons/daima/reposo-pose.png`; referencia JPG conservada junto al PNG. Fondo retirado mediante image_gen integrado. Prompt: quitar únicamente fondo claro conservando dibujo, pose, colores, cuerpo completo y marcas de autor existentes.

Selección del usuario, 22 de octubre de 2026: `/icons/series-icons/daima/combate-ssj4.png`; referencia JPG conservada junto al PNG. Fondo retirado mediante image_gen integrado. Prompt: quitar únicamente fondo claro conservando dibujo, pose, colores, cuerpo completo y marcas de autor existentes.

DB reposo: variante `db/reposo-guardia-sin-texto.png`, texto inferior retirado a petición del usuario mediante image_gen integrado. Prompt: retirar únicamente texto inferior manteniendo personaje y transparencia. Se conserva la referencia y la versión con crédito.

DBZ reposo actualizado el 22 de octubre de 2026: `dbz/reposo-brazos-cruzados.png`, imagen adjuntada por el usuario; original en `dbz/reposo-brazos-cruzados-referencia.jpg`. Fondo retirado mediante image_gen integrado. Prompt: quitar únicamente fondo blanco conservando dibujo, pose de brazos cruzados, cuerpo completo y colores. Sustituye a `reposo-ssj.png`.

GT reposo actualizado el 22 de octubre de 2026: `dbgt/reposo-clasico-hd.png`. Restauración de imagen adjuntada por el usuario, original en `dbgt/reposo-clasico-referencia.jpg`. Herramienta integrada image_gen. Prompt: mejorar nitidez, líneas y resolución, quitar ruido y fondo verde, conservar pose con manos en cintura, expresión, vestimenta y colores; transparencia real. Resultado: 894x1760. Sustituye a `reposo-ssj.png`.

Super reposo actualizado el 22 de octubre de 2026: `dbs/reposo-hombro.png`, imagen adjuntada por el usuario; original en `dbs/reposo-hombro-referencia.jpg`. Fondo retirado mediante image_gen integrado. Prompt: quitar únicamente fondo blanco, conservar pose con mano en hombro, cuerpo completo, colores y sombreado. Sustituye a `reposo-god.png`.

Kai reposo actualizado el 22 de octubre de 2026: `dbkai/reposo-frente.png`, imagen adjuntada por el usuario; original en `dbkai/reposo-frente-referencia.jpg`. Herramienta integrada image_gen. Prompt: retirar fondo blanco, recuadro, cielo y esferas detrás del personaje, conservando Goku completo, pose frontal, textura, colores y sombreado. Sustituye a `reposo-espaldas.png`.

DBZ ataque actualizado el 22 de octubre de 2026: `dbz/combate-kamehameha.png`, copia idéntica del ataque de Kai (`dbkai/combate-kamehameha.png`) a petición del usuario.

Kai ataque actualizado el 22 de octubre de 2026: `dbkai/combate-ssj-frontal.jpg`, imagen original adjuntada por el usuario, conservada sin editar y con fondo blanco. La eliminación del fondo mediante image_gen fue rechazada por el servicio. Sustituye a `dbkai/combate-kamehameha.png`; la copia de esa pose en DBZ se conserva.

Kai ataque actualizado el 22 de octubre de 2026: `dbkai/combate-ssj-lateral.png`, imagen adjuntada por el usuario; original conservado en `dbkai/combate-ssj-lateral-referencia.jpg`. Fondo retirado mediante image_gen integrado. Prompt: quitar únicamente fondo blanco, conservar pose lateral de ataque, cuerpo completo, colores y sombreado. Sustituye a `combate-ssj-frontal.jpg`.

Daima ataque actualizado el 22 de octubre de 2026: `daima/combate-ssj-kamehameha.png`, imagen adjuntada por el usuario; original en `daima/combate-ssj-kamehameha-referencia.png`. Fondo retirado mediante image_gen integrado. Prompt: quitar únicamente fondo blanco conservando brillo entre manos, detalles blancos interiores, pose, cuerpo completo y colores. Sustituye a `combate-ssj4.png`.
