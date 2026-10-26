// Tamaño unificado de los heroes cinematográficos (Home / Series / Películas).
// Grande con distancia mínima sobre las islas flotantes inferiores
// (aleatorio/maratón/audio: fixed bottom-5 → ~64px de reserva).
// En mobile el stage es vertical (min-h manda sobre el 16:9): qué parte de la
// imagen queda visible lo decide el punto focal de HeroArt, no el centro.
// El bloque de texto ocupa ~330px: el alto nunca baja de 540px en desktop para
// no tapar al sujeto.
// En desktop el stage se adapta a lo que entra en pantalla (100dvh − ~218px de
// barras superiores y reserva de las islas inferiores aleatorio/maratón/audio):
// así los CTA del hero no quedan debajo de esas islas fijas en pantallas bajas.
//   ≥1080px de alto → 682–748px (como siempre) · 900px → 682px · 768px → 550px.
//
// Tope de proporción (~2.35:1) en desktop: en monitores ultra-anchos (21:9) el stage no
// se estira más allá de su alto máximo × 2.35 y se centra; así el relleno a la izquierda
// del arte 16:9 se queda en ~25 % en vez de llegar al 46 %.
export const HERO_STAGE_CLASS =
    "lg:max-w-[calc(var(--hero-stage-max-h,min(860px,max(540px,calc(100dvh-170px))))*2.35)] lg:mx-auto aspect-[16/9] sm:aspect-[1.9/1] lg:aspect-[1.85/1] min-h-[var(--hero-stage-min-h-mobile,528px)] sm:min-h-[var(--hero-stage-min-h-sm,616px)] lg:min-h-[var(--hero-stage-min-h-lg,min(860px,max(540px,calc(100dvh-170px))))] max-h-[var(--hero-stage-max-h,748px)] lg:max-h-[var(--hero-stage-max-h,min(860px,max(540px,calc(100dvh-170px))))]"

// Parallax del backdrop del Home: la capa sobresale esto por arriba del stage
// y el desplazamiento se topa en el mismo valor, así nunca queda franja vacía.
export const HERO_PARALLAX_OVERSCAN = 40

// Aura ambiental detrás de los heroes: acompaña al stage sin excederlo.
export const HERO_AURA_CLASS =
    "absolute top-0 left-1/2 w-screen -translate-x-1/2 h-[var(--hero-stage-min-h-mobile,528px)] sm:h-[var(--hero-stage-min-h-sm,616px)] md:h-[682px] lg:h-[var(--hero-stage-max-h,748px)] pointer-events-none overflow-hidden z-hero-base transform-gpu"
