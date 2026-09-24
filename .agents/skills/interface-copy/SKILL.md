---
name: interface-copy
description: Pautas de redacción, microcopy y tono en español para KameHouse (empty states, errores, botones, sinopsis y diálogos).
---

# Interface Copy & Microcopy (KameHouse Edition)

Pautas de redacción, claridad de lenguaje y tono para la interfaz de KameHouse en español (tono neutro latinoamericano / rioplatense sutil, cinemático y directo).

## 1. Tono y Voz

- **Cinemático y Directo**: KameHouse es un centro multimedia. El lenguaje debe sentirse moderno, inmersivo y claro.
- **Accionable**: Cada mensaje debe indicar al usuario qué está pasando o qué puede hacer a continuación.
- **Sin tecnicismos innecesarios**: Evitar jerga de backend ("500 Internal Server Error", "NullPointer", "WebSocket reconnecting"). Traducir los eventos técnicos a estados comprensibles para el usuario.

## 2. Empty States (Estados Vacíos)

Todo estado vacío debe seguir una estructura de 3 niveles:
1. **Título**: Explica qué falta de forma clara y directa.
2. **Descripción**: Breve contexto de por qué está vacío o cómo llenarlo.
3. **CTA (Llamada a la acción)**: Botón con acción clara y radio `rounded-full`.

### Ejemplos
- **Biblioteca vacía**:
  - *Título*: "Tu biblioteca está vacía"
  - *Descripción*: "Agregá carpetas con tus series o películas desde la configuración para comenzar."
  - *CTA*: "Configurar biblioteca"
- **Sin resultados de búsqueda**:
  - *Título*: "No encontramos coincidencias"
  - *Descripción*: "Revisá que el nombre esté bien escrito o probá con otros términos."
- **Sin episodios pendientes**:
  - *Título*: "Estás al día"
  - *Descripción*: "No hay nuevos episodios pendientes en esta saga."

## 3. Mensajes de Error

- **Principio**: Decir qué pasó, por qué importa y cómo resolverlo.
- **Reproducción**:
  - *Malo*: `Error: MediaElement failed (CODE 4)`
  - *Bueno*: "No pudimos reproducir este video. Verificá que el archivo siga disponible o intentá con otra pista de audio."
- **Sincronización / Red**:
  - *Malo*: `Connection refused 127.0.0.1:8080`
  - *Bueno*: "No pudimos conectar con el servidor local. Comprobá que KameHouse Server esté en ejecución."
- **Siempre ofrecer una salida**: Botón "Reintentar", "Verificar conexión" o "Cerrar".

## 4. Botones y Acciones

- **Verbos al inicio**: Usar infinitivo para las acciones principales:
  - "Reproducir", "Reanudar", "Descargar", "Sincronizar ahora", "Guardar cambios".
- **Evitar "Aceptar" genérico**:
  - Para confirmaciones destructivas: "Eliminar historial", "Borrar caché", "Cancelar".
  - Para modales informativos: "Entendido", "Cerrar".
- **Botones de estado**:
  - "Guardando..." en vez de "Guardar" mientras la promesa esté pendiente.

## 5. Tooltips y Ayudas Secundarias

- Los tooltips deben complementar, nunca repetir lo que ya dice el texto del botón.
  - *Innecesario*: Botón "Descargar" con tooltip "Descarga el archivo".
  - *Útil*: Botón con icono de nube con tooltip "Disponible para ver sin conexión (1.2 GB)".
