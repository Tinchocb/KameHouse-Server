# 📜 Propuesta de Rediseño: Cronología Interactiva & Modo Historia

> **Objetivo**: Transformar la sección de Cronología de una lista tradicional de fichas y textos extensos a una **experiencia narrativa interactiva y cinematográfica** donde el usuario viaje por la historia de Dragon Ball, recibiendo resúmenes dinámicos del "Narrador", conociendo el estado del universo y los hitos clave mientras desplaza la línea de tiempo.

---

## 1. Diagnóstico: ¿Por qué la versión actual se siente desconectada?

1. **Estructura tipo catálogo convencional**: Actualmente la página repite el patrón de Home (`JourneyHero` grande + rieles horizontales de tarjetas por serie). No se percibe como una "línea de tiempo viva".
2. **Panel de texto saturado al pie**: El narrador actual está confinado en un panel inferior (`NarratorPanel`) que acumula bloques de texto densos (`detailedPlot`, `previouslyOn`) con scroll interno, lo que obliga al usuario a leer parrafadas en lugar de vivir un viaje guiado.
3. **Falta de sincronización cinemática**: Al hacer clic en un arco no hay sensación de progresión temporal ni de cambio de época; se siente como cambiar de pestaña en un reproductor.
4. **Desaprovechamiento de datos ricos**: El archivo `cronologia_lapsos_dragonball.json` cuenta con datos extraordinarios que hoy no brillan en la UI:
   - `inUniverseYears` (Años oficiales del Dragón World: Año 749, 762, etc.).
   - `worldStateAtStart` (Nivel de amenaza, villanos activos, estado de las esferas, edad/estado de los personajes).
   - `quickCatchUpKeys` (Ideas fuerza para entender la saga en 10 segundos).
   - `milestones` (Momentos cumbre con su número de episodio específico).

---

## 2. Recomendación Conceptual: "El Relato del Dragón" (Interactive Story Scrubber)

La mejor recomendación es adoptar una **interfaz cinemática de scrubber temporal (Timeline Scrubber + Story Canvas)** inspirada en los interactivos documentales y videojuegos donde avanzas un dial o capítulos:

```
+------------------------------------------------------------------------------------+
| [Logo / Volver]            LÍNEA TEMPORAL DE DRAGON BALL           [Filtro Spoiler] |
+------------------------------------------------------------------------------------+
|                                                                                    |
|  --[1986 DB]---------*------[1989 DBZ]---------●---------[2015 SUPER]-----[DAIMA]- |
|                    Año 753                   Año 762 (Seleccionado)                |
|                    Piccolo                   Saga de Freezer                       |
|                                                                                    |
+------------------------------------------------------------------------------------+
|                                                                                    |
|   +--------------------------+   +-----------------------------------------------+ |
|   |  FOTOGRAMA / BACKDROP    |   |  ÉPOCA: AÑO 762 · PLANETA NAMEKUSEI          | |
|   |  ATMOSFÉRICO             |   |  AMENAZA: CATASTRÓFICA (Freezer y su ejército)| |
|   |                          |   +-----------------------------------------------+ |
|   |  [ Visual de la Saga ]   |   |  "EL DESPERTAR DEL GUERRERO LEGENDARIO"       | |
|   |                          |   |                                               | |
|   |  Aura reactiva de la era |   |  Resumen del Narrador:                        | |
|   |  (Verde Namek / Oro SSJ) |   |  Goku se recupera en la cápsula de regenera-  | |
|   |                          |   |  ción mientras sus amigos caen uno a uno ante | |
|   |  [ ▶ Reproducir Clave ]  |   |  la crueldad del tirano galáctico...          | |
|   +--------------------------+   +-----------------------------------------------+ |
|                                                                                    |
|   +------------------------------------------------------------------------------+ |
|   |  ESTADO DEL MUNDO (SCOUTER DE LORE)                                          | |
|   |  - Goku: 25 años (Gravedad 100x)  ·  Esferas: Petrificadas tras muerte Saichoro|
|   |  - Villanos: Freezer (Forma Final) ·  Bajas: Vegeta, Krilin (Desata el SSJ)   | |
|   +------------------------------------------------------------------------------+ |
|                                                                                    |
|   [◀ Anterior Saga (Saiyajin)]          [Auto-Play Relato]     [Siguiente Saga (Cell) ▶]
+------------------------------------------------------------------------------------+
```

---

## 3. Pilares de la Nueva Experiencia

### A. El Scrubber Temporal Continuo (The Time Dial)
* **Barra superior fluida**: En lugar de simples botones de serie, se muestra una regla temporal con los años in-universe (desde Año 749 en la Montaña Paoz hasta Año 784+ en el Torneo de las Artes Marciales).
* **Nodos de Saga interactivos**: Cada saga o lapso es un punto estelar o cápsula Capsule Corp. Al pasar el ratón (hover) se previsualiza una miniatura y el título; al hacer clic o arrastrar el dial, la historia transiciona al instante con animaciones fluidas (Framer Motion).
* **Navegación por teclado y gestos**:
  * Flechas `←` y `→`: Salto inmediato al arco anterior o siguiente.
  * Tecla `Espacio`: Poner en marcha el "Auto-Play del Relato" (recorre la historia automáticamente a un ritmo de lectura cómodo con barra de progreso).

### B. El Escenario Narrativo (Story Canvas)
En lugar de muros de texto, el resumen se presenta en tres niveles de profundidad:
1. **Nivel 1: El Flash / Gancho (5 segundos)**:
   - Título épico del arco.
   - Píldoras clave (`quickCatchUpKeys`): 3 viñetas destacadas que resumen todo el conflicto de un vistazo.
2. **Nivel 2: La Voz del Narrador (30 segundos)**:
   - Un texto cuidado con tono de introducción clásica de Dragon Ball (*"En un rincón apartado del universo..."*).
   - Animación de entrada suave (text fade-in con spring de Framer Motion).
3. **Nivel 3: El Escáner de Lore (Scouter del Mundo)**:
   - **Nivel de Amenaza**: Insignia animada (*Bajo / Cómico*, *Planeta en Peligro*, *Crisis Espacio-Temporal*).
   - **Edad y Estado de Goku**: Cómo va evolucionando (12 años, 16 años, 24 años, etc.).
   - **Estado de las Esferas**: Dónde están en ese momento (disponibles, en enfriamiento de 1 año, destruidas, convertidas en piedra).
   - **Villanos Activos y Aliados Clave**.

### C. Hitos Cinemáticos (Milestones) y Salto al Player
* Dentro de cada lapso, se muestran los 2-3 **Momentos Cumbre** (ej. *Capítulo 1: El Encuentro*, *Capítulo 8: El Primer Kamehameha*, *Capítulo 95: La Transformación en Super Saiyajin*).
* Cada hito tiene un botón directo para **ver ese episodio en KameHouse** sin tener que salir a buscar la serie en el catálogo.

### D. Relación con Películas y OVAs (Línea de Tiempo Paralela)
* Debajo del escenario principal, un riel sutil muestra: *"Películas que transcurren durante este lapso"*.
* Por ejemplo, al situarse en la Saga de Cell, se vinculan *Los Guerreros de Plata (Bojack)* o *¡El Regreso de Broly!*, explicando brevemente si son canónicas o historias alternativas.

### E. Protección Anti-Spoilers Inteligente
* Si el usuario activa el modo **"Mi Progreso"**, la línea de tiempo se ilumina solo hasta donde el usuario ha visto en su cuenta.
* Los arcos futuros aparecen con una bruma de niebla mística y el mensaje: *"Completa la saga anterior para revelar este fragmento de la historia"*, con opción de revelar manualmente si el usuario ya conoce la trama.

---

## 4. Opciones de Diseño para Elegir

| Opción | Formato Visual | Ventajas | Ideal para... |
| :--- | :--- | :--- | :--- |
| **Opción 1: Cinematic Story Scrubber (Recomendada)** | Dial horizontal superior fijo + Escenario heroico con visuales inmersivos, resumen del narrador y Scouter de lore | Sensación de videojuego / documental interactivo AAA. Máximo impacto visual y fácil de navegar paso a paso. | Experiencia central inmersiva en Desktop y Smart TV. |
| **Opción 2: Vertical Manga / Story Scroll** | Línea de tiempo vertical central que se despliega al hacer scroll, revelando cada arco secuencialmente como capítulos | Muy natural para lectura en móviles y tablets. Fácil de leer de un tirón con el pulgar. | Usuarios que prefieren hacer scroll como leyendo un cómic digital o bitácora. |
| **Opción 3: Modo Híbrido (Scrubber + Resumen Plegable)** | Línea temporal horizontal arriba + Vista resumen con pestañas ("Resumen Narrativo", "Estado del Mundo", "Episodios Clave") | Muy modular y ordenado, permite leer en detalle sin saturar la pantalla en pantallas medianas. | Máxima flexibilidad para todo tipo de resoluciones. |

---

## 5. Arquitectura Técnica de Implementación en KameHouse

* **Ruta**: [apps/web/src/routes/chronology/index.tsx](file:///c:/Users/Pame/Desktop/KameHouse-Server/apps/web/src/routes/chronology/index.tsx)
* **Subcomponentes sugeridos**:
  1. `ChronologyScrubber.tsx`: Barra de tiempo con escala de años, animaciones con Framer Motion y soporte de teclado/drag.
  2. `StoryNarratorCard.tsx`: Escenario principal con backdrop ambiental, título de saga, resumen y píldoras.
  3. `WorldLoreScouter.tsx`: Tarjeta interactiva con la edad del protagonista, estado de las esferas y villanos.
  4. `MilestoneQuickLauncher.tsx`: Accesos directos a los episodios clave en el player.
  5. `StoryAutoPlayer.ts`: Hook para avanzar automáticamente de saga cada N segundos con barra de progreso.

---

## 6. Siguientes Pasos

1. Revisar este documento de idea y elegir la dirección preferida (por defecto recomendamos la **Opción 1: Cinematic Story Scrubber**).
2. Comenzar la implementación creando los componentes del Scrubber interactivo y la vista del Narrador con los tokens de diseño de KameHouse.
