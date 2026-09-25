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
export const HERO_STAGE_CLASS =
    "aspect-[16/9] sm:aspect-[1.9/1] lg:aspect-[1.85/1] min-h-[var(--hero-stage-min-h-mobile,528px)] sm:min-h-[var(--hero-stage-min-h-sm,616px)] lg:min-h-[var(--hero-stage-min-h-lg,min(682px,max(540px,calc(100dvh-218px))))] max-h-[var(--hero-stage-max-h,748px)] lg:max-h-[var(--hero-stage-max-h,min(748px,max(540px,calc(100dvh-218px))))]"

// Parallax del backdrop del Home: la capa sobresale esto por arriba del stage
// y el desplazamiento se topa en el mismo valor, así nunca queda franja vacía.
export const HERO_PARALLAX_OVERSCAN = 40

// Aura ambiental detrás de los heroes: acompaña al stage sin excederlo.
export const HERO_AURA_CLASS =
    "absolute top-0 inset-x-0 h-[var(--hero-stage-min-h-mobile,528px)] sm:h-[var(--hero-stage-min-h-sm,616px)] md:h-[682px] lg:h-[var(--hero-stage-max-h,748px)] pointer-events-none overflow-hidden z-hero-base transform-gpu"
