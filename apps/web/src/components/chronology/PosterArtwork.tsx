import React from 'react';
import { VolumeData } from './types';

interface PosterArtworkProps {
  volume: VolumeData;
  isFlipped?: boolean;
}

export const PosterArtwork: React.FC<PosterArtworkProps> = ({ volume }) => {
  const { id, posterUrl, title, coverArt } = volume;

  if (posterUrl) {
    return (
      <div className="relative w-full h-full overflow-hidden bg-surface-container flex items-center justify-center">
        <img
          src={posterUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
      </div>
    );
  }

  // Render iconic bespoke graphic compositions capturing the dramatic essence of each volume
  switch (id) {
    case 'db-piccolo-daimaku':
    case 'db-piccolo-jr':
    case 'vol-clasico-piccolo':
      return (
        <div className="relative w-full h-full overflow-hidden bg-surface-container flex flex-col items-center justify-center">
          {/* Eerie green demonic aura & misty backdrop */}
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-green-950/80 to-stone-950" />
          <div className="absolute inset-0 bg-halftone opacity-40 mix-blend-overlay" />
          
          {/* Ancient Royal Castle Throne & Pillars */}
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <svg viewBox="0 0 400 600" className="w-full h-full object-cover">
              <path d="M 60 550 L 60 220 L 90 180 L 120 220 L 120 550 Z" fill="#064e3b" />
              <path d="M 280 550 L 280 220 L 310 180 L 340 220 L 340 550 Z" fill="#064e3b" />
              <path d="M 120 550 L 150 280 L 200 240 L 250 280 L 280 550 Z" fill="#022c22" />
            </svg>
          </div>

          {/* Ominous silhouettes of Tambourine & Drum lurking in the shadows */}
          <div className="absolute top-16 left-6 opacity-60">
            <div className="w-12 h-14 bg-emerald-800/40 rounded-full relative flex items-center justify-center">
              <span className="text-3xs text-emerald-300 font-mono tracking-tighter">TAMBOURINE</span>
            </div>
          </div>
          <div className="absolute top-20 right-6 opacity-60">
            <div className="w-14 h-14 bg-emerald-800/40 rounded-full relative flex items-center justify-center">
              <span className="text-3xs text-emerald-300 font-mono tracking-tighter">DRUM</span>
            </div>
          </div>

          {/* Demon King Piccolo Hunched on Royal Throne */}
          <div className="relative z-10 flex flex-col items-center justify-center px-4 text-center">
            {/* Demon Crest "MA" Halo */}
            <div className="w-28 h-28 rounded-full border-2 border-emerald-500/50 bg-emerald-950/60 flex items-center justify-center shadow-[0_0_35px_rgba(16,185,129,0.3)] mb-2">
              <span className="font-kanji text-5xl font-black text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]">魔</span>
            </div>

            {/* Hunched King Silhouette with Antennas & Pointed Ears */}
            <div className="relative w-48 h-56 flex items-center justify-center">
              <svg viewBox="0 0 200 240" className="w-full h-full drop-shadow-[0_15px_25px_rgba(0,0,0,0.9)]">
                {/* Antennas */}
                <path d="M 85 45 Q 70 15 50 25" stroke="#34d399" strokeWidth="3" fill="none" />
                <path d="M 115 45 Q 130 15 150 25" stroke="#34d399" strokeWidth="3" fill="none" />
                {/* Pointed Ears */}
                <path d="M 65 65 L 40 55 L 68 75 Z" fill="#065f46" stroke="#059669" />
                <path d="M 135 65 L 160 55 L 132 75 Z" fill="#065f46" stroke="#059669" />
                {/* Hunched Head & Wrinkled Brow */}
                <path d="M 75 55 Q 100 45 125 55 Q 135 85 125 105 Q 100 115 75 105 Q 65 85 75 55 Z" fill="#047857" />
                {/* Glowing piercing red eyes */}
                <circle cx="88" cy="72" r="3" fill="#ef4444" className="animate-pulse" />
                <circle cx="112" cy="72" r="3" fill="#ef4444" className="animate-pulse" />
                {/* Robe and Decrepit Shoulders */}
                <path d="M 45 120 Q 100 90 155 120 L 175 220 Q 100 240 25 220 Z" fill="#14532d" />
                {/* Robe Collar & Crest */}
                <path d="M 80 120 L 100 165 L 120 120 Z" fill="#1e293b" />
                <circle cx="100" cy="148" r="14" fill="#064e3b" stroke="#34d399" strokeWidth="2" />
                <text x="100" y="154" textAnchor="middle" fontSize="13" fill="#86efac" fontWeight="bold" fontFamily="serif">魔</text>
              </svg>
            </div>

            {/* Glowing 1-Star Dragon Ball clutched in claws */}
            <div className="relative -mt-6 z-20 flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 shadow-[0_0_30px_rgba(245,158,11,0.9)] flex items-center justify-center border-2 border-amber-300">
                <span className="text-red-600 text-lg font-black drop-shadow">★</span>
              </div>
              <span className="text-3xs font-mono tracking-widest text-amber-300/80 mt-1 uppercase">Esfera de Una Estrella</span>
            </div>
          </div>

          {/* Broken Shenlong smoke at bottom */}
          <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-black via-emerald-950/80 to-transparent flex items-end justify-center pb-3">
            <span className="text-2xs font-serif tracking-widest text-emerald-400/90 border border-emerald-500/30 px-3 py-0.5 rounded-full bg-emerald-950/85">
              LA ERA DE LA OSCURIDAD TERRENAL
            </span>
          </div>
        </div>
      );

    case 'dbz-namek-viaje':
    case 'dbz-namek-ginyu-freezer':
    case 'dbz-freezer-super-saiyajin':
    case 'vol-freezer-ssj':
      return (
        <div className="relative w-full h-full overflow-hidden bg-surface-container flex flex-col items-center justify-center">
          {/* Cracking dying Planet Namek with toxic green sky & red fissures */}
          <div className="absolute inset-0 bg-gradient-to-t from-red-950 via-purple-950 to-emerald-950" />
          <div className="absolute inset-0 bg-manga-speed opacity-30" />

          {/* Apocalyptic Crimson Lightning Bolts */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-70">
            <path d="M 20 0 L 80 180 L 50 210 L 120 340 L 90 370 L 160 520" stroke="#f43f5e" strokeWidth="2.5" fill="none" filter="drop-shadow(0 0 8px #e11d48)" />
            <path d="M 380 40 L 320 200 L 350 230 L 290 380" stroke="#fbbf24" strokeWidth="2" fill="none" filter="drop-shadow(0 0 6px #f59e0b)" />
            {/* Tectonic fractures */}
            <path d="M 0 540 Q 150 510 240 560 T 400 520" stroke="#ef4444" strokeWidth="4" fill="none" />
          </svg>

          {/* Violent Golden Super Saiyan Ki Aura */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-80 h-96 bg-gradient-to-t from-amber-500/30 via-yellow-400/20 to-transparent rounded-full opacity-60" />
          </div>

          {/* Goku Super Saiyajin Looking Back Over His Shoulder */}
          <div className="relative z-10 flex flex-col items-center justify-center w-full px-4">
            {/* Golden Kanji Seal "Satoru / Wisdom" */}
            <div className="w-12 h-12 rounded-full border-2 border-amber-400/60 bg-amber-950/70 flex items-center justify-center mb-1 shadow-[0_0_20px_rgba(251,191,36,0.6)]">
              <span className="font-kanji text-2xl font-black text-amber-300">悟</span>
            </div>

            <div className="relative w-56 h-64 flex items-center justify-center">
              <svg viewBox="0 0 240 280" className="w-full h-full drop-shadow-[0_20px_35px_rgba(0,0,0,0.95)]">
                {/* Spiky Golden Super Saiyan Hair Flaring Upward */}
                <path d="M 70 120 L 40 50 L 90 70 L 110 10 L 135 65 L 170 25 L 165 85 L 205 60 L 175 125 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="3" />
                <path d="M 60 100 L 85 45 L 115 80 L 145 35 L 155 95 Z" fill="#fef08a" />
                
                {/* Muscular Neck & Battle Scars */}
                <path d="M 95 130 L 95 180 L 145 180 L 145 130 Z" fill="#fed7aa" />
                {/* Blood drip marks */}
                <line x1="110" y1="135" x2="110" y2="155" stroke="#b91c1c" strokeWidth="3" />
                <line x1="130" y1="140" x2="130" y2="160" stroke="#b91c1c" strokeWidth="2.5" />

                {/* Profile Jawline & Glare */}
                <path d="M 90 105 L 105 135 L 135 135 L 150 105 Z" fill="#ffedd5" />
                {/* Piercing Emerald Turquoise Eyes looking sideways */}
                <polygon points="120,112 135,110 132,118 118,118" fill="#06b6d4" stroke="#0891b2" strokeWidth="1.5" />
                <circle cx="126" cy="114" r="1.5" fill="#ffffff" />
                {/* Stern eyebrow furrow */}
                <path d="M 115 107 L 138 106" stroke="#b45309" strokeWidth="3.5" />

                {/* Torn Orange Martial Arts Gi & Blue Undershirt */}
                <path d="M 40 180 L 95 180 L 100 240 L 40 270 Z" fill="#ea580c" />
                <path d="M 145 180 L 200 180 L 200 270 L 140 240 Z" fill="#ea580c" />
                <path d="M 95 180 L 145 180 L 120 220 Z" fill="#1d4ed8" />
                {/* Chest lacerations from battle with 100% Freeza */}
                <path d="M 80 200 L 110 220" stroke="#991b1b" strokeWidth="3" />
                <path d="M 130 205 L 160 225" stroke="#991b1b" strokeWidth="2.5" />
              </svg>
            </div>

            {/* Planet Molten Countdown */}
            <div className="relative -mt-4 z-20 flex items-center space-x-2 bg-red-950/90 border border-red-500/50 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-3xs font-mono font-bold tracking-widest text-red-200 uppercase">
                Namek: Colapso en 5 Minutos
              </span>
            </div>
          </div>

          {/* Bottom Dramatic Title Pill */}
          <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-black via-purple-950/80 to-transparent flex items-end justify-center pb-3">
            <span className="text-2xs font-serif tracking-widest text-amber-300/90 border border-amber-500/30 px-3 py-0.5 rounded-full bg-purple-950/90">
              EL GUERRERO DE LA PROFECÍA MILENARIA
            </span>
          </div>
        </div>
      );

    case 'dbz-androides-trunks':
    case 'dbz-cell-imperfecto-perfeccion':
    case 'vol-cell-trunks':
      return (
        <div className="relative w-full h-full overflow-hidden bg-surface-container flex flex-col items-center justify-center">
          {/* Cyberpunk apocalyptic wasteland & overgrown weeds */}
          <div className="absolute inset-0 bg-gradient-to-t from-teal-950 via-zinc-900 to-stone-950" />
          <div className="absolute inset-0 bg-manga-speed opacity-25" />

          {/* Bio-mechanical Grid & Neon Warning Matrix */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
            <line x1="0" y1="100" x2="400" y2="100" stroke="#14b8a6" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1="300" x2="400" y2="300" stroke="#14b8a6" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1="450" x2="400" y2="450" stroke="#14b8a6" strokeWidth="1" strokeDasharray="4 4" />
          </svg>

          {/* Future Trunks Silhouetted with gleaming Broadsword */}
          <div className="relative z-10 flex flex-col items-center justify-center px-4 w-full text-center">
            {/* Capsule Corp & Mirai Badge */}
            <div className="w-12 h-12 rounded-full border-2 border-teal-400/60 bg-teal-950/70 flex items-center justify-center mb-1 shadow-[0_0_20px_rgba(20,184,166,0.6)]">
              <span className="font-kanji text-xl font-black text-teal-200">未来</span>
            </div>

            {/* Trunks Sheathing Sword with "17" and "18" reflections */}
            <div className="relative w-56 h-64 flex items-center justify-center">
              <svg viewBox="0 0 240 280" className="w-full h-full drop-shadow-[0_20px_35px_rgba(0,0,0,0.95)]">
                {/* Purple Capsule Corp Jacket & Lavender Hair */}
                {/* Lavender Hair Curtains */}
                <path d="M 80 80 Q 90 20 120 30 Q 150 20 160 80 Q 140 100 120 105 Q 100 100 80 80 Z" fill="#c4b5fd" stroke="#7c3aed" strokeWidth="2" />
                <path d="M 85 70 L 80 120 L 95 110 Z" fill="#ddd6fe" />
                <path d="M 155 70 L 160 120 L 145 110 Z" fill="#ddd6fe" />

                {/* Face & Somber Intense Eyes */}
                <path d="M 95 90 L 120 125 L 145 90 Z" fill="#ffedd5" />
                <line x1="105" y1="98" x2="116" y2="98" stroke="#0284c7" strokeWidth="2" />
                <line x1="124" y1="98" x2="135" y2="98" stroke="#0284c7" strokeWidth="2" />

                {/* Broadsword Blade diagonally cutting through composition */}
                <polygon points="40,240 180,60 195,70 55,250" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" filter="drop-shadow(0 0 10px rgba(45,212,191,0.8))" />
                {/* Blood stain on blade edge */}
                <path d="M 160 85 Q 165 95 155 105 Z" fill="#dc2626" />
                
                {/* Reflections of "17" and "18" etched into the steel */}
                <text x="135" y="125" fill="#0f172a" fontSize="13" fontWeight="900" fontFamily="sans-serif" transform="rotate(-40 135 125)">#17</text>
                <text x="110" y="155" fill="#0f172a" fontSize="13" fontWeight="900" fontFamily="sans-serif" transform="rotate(-40 110 155)">#18</text>

                {/* Purple Jacket with Capsule Logo on Shoulder */}
                <path d="M 60 130 L 100 130 L 90 220 L 40 220 Z" fill="#4338ca" />
                <path d="M 140 130 L 180 130 L 200 220 L 150 220 Z" fill="#4338ca" />
                {/* Capsule Corp Logo */}
                <circle cx="70" cy="160" r="10" fill="#f8fafc" />
                <circle cx="70" cy="160" r="6" fill="#4338ca" />

                {/* Sword Scabbard Strap */}
                <line x1="60" y1="130" x2="180" y2="220" stroke="#ea580c" strokeWidth="7" />
              </svg>
            </div>

            {/* Cracked Larval Cell Egg in Overgrown Grass */}
            <div className="relative -mt-4 z-20 flex items-center space-x-2 bg-emerald-950/90 border border-teal-500/50 px-3 py-1 rounded-full">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-3xs font-mono tracking-wider text-teal-200 uppercase">
                Huevo Mudado: Especie Bio-Mecánica
              </span>
            </div>
          </div>

          {/* Bottom Tagline */}
          <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-black via-teal-950/80 to-transparent flex items-end justify-center pb-3">
            <span className="text-2xs font-serif tracking-widest text-teal-300/90 border border-teal-500/30 px-3 py-0.5 rounded-full bg-teal-950/90">
              LA HEREJÍA DE LAS LÍNEAS TEMPORALES
            </span>
          </div>
        </div>
      );

    case 'dbz-saiyajin-raditz':
    case 'dbz-saiyajin-vegeta':
    case 'vol-saiyan-choque':
      return (
        <div className="relative w-full h-full overflow-hidden bg-surface-container flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-t from-red-950 via-amber-950 to-neutral-950" />
          <div className="absolute inset-0 bg-manga-speed opacity-30" />
          {/* Colossal energy clash of Kaioken vs Galick Ho */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
            <div className="w-12 h-12 rounded-full border border-red-500 bg-red-950 flex items-center justify-center mb-2">
              <span className="font-kanji text-2xl text-red-400 font-bold">界</span>
            </div>
            <div className="w-48 h-48 relative flex items-center justify-center">
              {/* Red Beam from bottom left */}
              <div className="absolute bottom-0 left-2 w-28 h-28 bg-red-500/30 rounded-full opacity-70" />
              {/* Purple Beam from top right */}
              <div className="absolute top-0 right-2 w-28 h-28 bg-purple-600/30 rounded-full opacity-70" />
              {/* Clash Core */}
              <div className="w-16 h-16 rounded-full bg-white shadow-[0_0_40px_#ffffff] z-10 border-4 border-amber-400 flex items-center justify-center">
                <span className="text-3xs font-mono text-black font-black">KAIOKEN x4</span>
              </div>
            </div>
            <p className="text-xs font-mono text-red-300 mt-2">Duelo Tectónico en los Páramos</p>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black via-red-950/80 to-transparent flex items-end justify-center pb-3">
            <span className="text-3xs font-serif text-red-300 border border-red-500/30 px-3 py-0.5 rounded-full">
              SANGRE DE LA ESTIRPE SAIYAJIN
            </span>
          </div>
        </div>
      );

    case 'db-pilaf':
    case 'db-torneo-21':
    case 'vol-clasico-origen':
      return (
        <div className="relative w-full h-full overflow-hidden bg-surface-container flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-t from-amber-950 via-emerald-950/70 to-stone-950" />
          <div className="absolute inset-0 bg-halftone opacity-35 mix-blend-overlay" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
            {/* Kame Emblem */}
            <div className="w-14 h-14 rounded-full border-2 border-amber-400 bg-amber-950/80 flex items-center justify-center mb-2 shadow-[0_0_25px_rgba(245,158,11,0.7)]">
              <span className="font-kanji text-3xl font-black text-amber-300">亀</span>
            </div>
            {/* Flying Nyoibo and 4-star ball */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 shadow-[0_0_40px_rgba(251,191,36,0.9)] flex items-center justify-center border-2 border-yellow-100">
                <div className="grid grid-cols-2 gap-1 text-red-600 text-sm font-black">
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                </div>
              </div>
              {/* Red Power Pole diagonally */}
              <div className="absolute w-52 h-2.5 bg-red-600 rounded-full shadow-[0_0_10px_#dc2626] rotate-45" />
            </div>
            <span className="text-xs font-mono text-amber-300 mt-2 tracking-wider uppercase">Esfera de Cuatro Estrellas</span>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black via-amber-950/80 to-transparent flex items-end justify-center pb-3">
            <span className="text-3xs font-serif text-amber-300 border border-amber-500/30 px-3 py-0.5 rounded-full">
              EL COMIENZO DE LA LEYENDA
            </span>
          </div>
        </div>
      );

    case 'dbz-juegos-de-cell':
    case 'dbz-torneo-otro-mundo':
    case 'vol-cell-games':
      return (
        <div className="relative w-full h-full overflow-hidden bg-surface-container flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-teal-950/80 to-neutral-950" />
          <div className="absolute inset-0 bg-manga-speed opacity-35" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
            <div className="w-12 h-12 rounded-full border-2 border-emerald-400 bg-emerald-950 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(16,185,129,0.7)]">
              <span className="font-kanji text-2xl text-emerald-300 font-black">極</span>
            </div>
            {/* SSJ2 Lightning and Father-Son Kamehameha Aura */}
            <div className="relative w-48 h-48 flex items-center justify-center">
              {/* Golden & Blue Ki Beams */}
              <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-cyan-400/40 via-yellow-400/50 to-transparent blur-lg opacity-60 transform-gpu" />
              {/* Lightning vectors */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <path d="M 20 40 L 60 90 L 40 120 L 90 160" stroke="#38bdf8" strokeWidth="2" fill="none" filter="drop-shadow(0 0 6px #38bdf8)" />
                <path d="M 180 30 L 140 80 L 160 110 L 110 150" stroke="#facc15" strokeWidth="2" fill="none" filter="drop-shadow(0 0 6px #facc15)" />
              </svg>
              <div className="w-24 h-24 rounded-full border-2 border-cyan-300 bg-cyan-950/70 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(56,189,248,0.8)]">
                <span className="text-3xs font-mono text-cyan-200 font-bold">GOHAN SSJ2</span>
                <span className="text-5xs font-mono text-yellow-300 mt-0.5">CHISPAS ELÉCTRICAS</span>
              </div>
            </div>
            <span className="text-xs font-mono text-emerald-300 mt-1">Kamehameha Padre e Hijo</span>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black via-emerald-950/80 to-transparent flex items-end justify-center pb-3">
            <span className="text-3xs font-serif text-emerald-300 border border-emerald-500/30 px-3 py-0.5 rounded-full">
              EL CLÍMAX DE LOS CELL GAMES
            </span>
          </div>
        </div>
      );

    case 'dbz-buu-majin-vegeta':
    case 'dbz-buu-ssj3-fusion':
    case 'dbz-buu-gotenks-gohan-mistico':
    case 'dbz-buu-vegetto-kidbuu-final':
    case 'vol-buu-caos':
    case 'vol-buu-magia':
      return (
        <div className="relative w-full h-full overflow-hidden bg-surface-container flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-t from-pink-950 via-purple-950 to-stone-950" />
          <div className="absolute inset-0 bg-halftone opacity-30" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
            {/* Majin M Emblem */}
            <div className="w-14 h-14 rounded-full border-2 border-pink-400 bg-pink-950/80 flex items-center justify-center mb-2 shadow-[0_0_25px_rgba(244,114,182,0.8)]">
              <span className="font-display text-4xl text-pink-400 font-bold tracking-widest">M</span>
            </div>
            {/* Pink chaotic blob & steam chimneys */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              <div className="w-36 h-36 rounded-full bg-gradient-to-br from-pink-400 to-pink-700 shadow-[0_0_30px_rgba(236,72,153,0.7)] flex items-center justify-center">
                <div className="text-stone-950 font-black text-center text-xs px-2">
                  <div className="text-lg">魔人ブウ</div>
                  <div className="text-4xs uppercase tracking-wider font-mono">Caos Inmemorial</div>
                </div>
              </div>
            </div>
            <span className="text-xs font-mono text-pink-300 mt-1">Sello del Mago Babidi Roto</span>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black via-pink-950/80 to-transparent flex items-end justify-center pb-3">
            <span className="text-3xs font-serif text-pink-300 border border-pink-500/30 px-3 py-0.5 rounded-full">
              LA TRANSMUTACIÓN DE LA MATERIA
            </span>
          </div>
        </div>
      );

    case 'dbs-goku-black':
    case 'vol-super-black':
      return (
        <div className="relative w-full h-full overflow-hidden bg-surface-container flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-t from-purple-950 via-fuchsia-950/80 to-zinc-950" />
          <div className="absolute inset-0 bg-manga-speed opacity-35" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
            <div className="w-12 h-12 rounded-full border-2 border-fuchsia-400 bg-purple-950 flex items-center justify-center mb-2 shadow-[0_0_25px_rgba(217,70,239,0.8)]">
              <span className="font-kanji text-2xl text-fuchsia-300 font-black">黒</span>
            </div>
            {/* Violet Ki Blade & Time Ring */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-fuchsia-600/40 via-purple-600/50 to-transparent blur-lg opacity-60 transform-gpu" />
              {/* Ki blade path */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <polygon points="40,160 140,40 155,50 55,170" fill="#e879f9" filter="drop-shadow(0 0 10px #c026d3)" />
              </svg>
              {/* Time ring icon */}
              <div className="w-16 h-16 rounded-full border-4 border-slate-300 bg-emerald-950/80 flex items-center justify-center shadow-[0_0_20px_#10b981] z-10">
                <span className="text-4xs font-mono text-emerald-300 font-black">ANILLO</span>
              </div>
            </div>
            <span className="text-xs font-mono text-fuchsia-300 mt-1">Super Saiyajin Rosé & Zarcillo Potara</span>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black via-purple-950/80 to-transparent flex items-end justify-center pb-3">
            <span className="text-3xs font-serif text-fuchsia-300 border border-fuchsia-500/30 px-3 py-0.5 rounded-full">
              EL JUICIO CERO HUMANOS
            </span>
          </div>
        </div>
      );

    case 'dbs-exhibicion-zen':
    case 'dbs-reclutamiento-u7':
    case 'dbs-torneo-del-poder':
    case 'vol-super-torneo':
      return (
        <div className="relative w-full h-full overflow-hidden bg-surface-container flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-cyan-950/80 to-purple-950/90" />
          <div className="absolute inset-0 bg-manga-speed opacity-40" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
            <div className="w-12 h-12 rounded-full border-2 border-slate-300 bg-slate-950 flex items-center justify-center mb-2 shadow-[0_0_25px_rgba(255,255,255,0.8)]">
              <span className="font-kanji text-2xl text-slate-100 font-black">無</span>
            </div>
            {/* Silver Ultra Instinct Heat & Cosmic Dust */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-cyan-400/30 via-white/50 to-blue-600/30 blur-lg opacity-60 transform-gpu" />
              <div className="w-24 h-24 rounded-full border-2 border-white/80 bg-slate-900/90 flex flex-col items-center justify-center shadow-[0_0_35px_rgba(255,255,255,0.9)]">
                <span className="text-xs font-mono text-white font-black tracking-wider">MIGATTE</span>
                <span className="text-5xs font-mono text-cyan-300">ULTRA INSTINTO</span>
              </div>
            </div>
            <span className="text-xs font-mono text-cyan-200 mt-1">Supervivencia de los 8 Universos</span>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black via-slate-950/80 to-transparent flex items-end justify-center pb-3">
            <span className="text-3xs font-serif text-cyan-200 border border-cyan-400/40 px-3 py-0.5 rounded-full">
              LA DOCTRINA EGOÍSTA SUPREMA
            </span>
          </div>
        </div>
      );

    case 'dbs-batalla-dioses':
    case 'dbs-resurreccion-f':
    case 'vol-super-dioses':
      return (
        <div className="relative w-full h-full overflow-hidden bg-surface-container flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-950 via-blue-950 to-indigo-950" />
          <div className="absolute inset-0 bg-manga-speed opacity-30" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-400 bg-cyan-950 flex items-center justify-center mb-2 shadow-[0_0_25px_rgba(6,182,212,0.8)]">
              <span className="font-kanji text-2xl text-cyan-300 font-bold">神</span>
            </div>
            <div className="w-44 h-44 relative flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-cyan-500/30 to-red-500/30 blur-lg opacity-60 transform-gpu" />
              <div className="w-24 h-24 rounded-full border-2 border-cyan-300 flex items-center justify-center bg-cyan-950/80">
                <span className="text-xs font-display tracking-widest text-cyan-200">KI DIVINO</span>
              </div>
            </div>
            <span className="text-xs font-mono text-cyan-300 mt-1">Ondas Gravitacionales del Universo 7</span>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black via-cyan-950/80 to-transparent flex items-end justify-center pb-3">
            <span className="text-3xs font-serif text-cyan-300 border border-cyan-500/30 px-3 py-0.5 rounded-full">
              EL DESPERTAR DE LORD BEERUS
            </span>
          </div>
        </div>
      );

default:
      return (
        <div className={`relative w-full h-full overflow-hidden bg-surface-container flex flex-col items-center justify-center bg-gradient-to-t ${coverArt?.auraGradient ?? 'from-surface-container via-zinc-900 to-black'}`} style={{ '--poster-accent': coverArt?.accentHex ?? 'var(--brand-accent-hex)' } as React.CSSProperties}>
          <div className="absolute inset-0 bg-manga-speed opacity-25" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
            <div
              className="w-14 h-14 rounded-full border-2 flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(255,255,255,0.4)]"
              style={{ borderColor: 'var(--poster-accent)', backgroundColor: 'rgba(0,0,0,0.6)' }}
            >
              <span className="font-kanji text-3xl font-black" style={{ color: 'var(--poster-accent)' }}>
                {coverArt?.symbolGlyph ?? '悟'}
              </span>
            </div>
            <h4 className="font-display font-black text-sm tracking-wider uppercase text-white mb-1">
              {volume.title}
            </h4>
            <span className="text-2xs font-mono text-on-surface-variant max-w-[200px] line-clamp-2">
              {volume.subtitle}
            </span>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-black via-black/70 to-transparent flex items-end justify-center pb-3">
            <span
              className="text-3xs font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full border"
              style={{
                color: 'var(--poster-accent)',
                borderColor: 'color-mix(in srgb, var(--poster-accent) 25%, transparent)',
                backgroundColor: 'rgba(0,0,0,0.5)',
              }}
            >
              {volume.volumeNumber} \u00b7 {volume.officialYear}
            </span>
          </div>
        </div>
      );
  }
};
