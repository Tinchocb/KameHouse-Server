import { useCallback } from "react";

// Static global pool to cache HTMLAudioElement instances and prevent GC thrashing
const sfxPool: Record<string, HTMLAudioElement> = {};

export type SfxType = 
    | "hover"    // /sounds/seleccion de hover.wav
    | "series"   // /sounds/serie.wav
    | "detail";  // /sounds/entrar detalle serie-peliculas.wav

const SFX_PATHS: Record<SfxType, string> = {
    hover: "/sounds/seleccion de hover.wav",
    series: "/sounds/serie.wav",
    detail: "/sounds/entrar detalle serie-peliculas.wav"
};

export function useSound() {
    const playSound = useCallback((type: SfxType, volume = 0.15) => {
        try {
            const path = SFX_PATHS[type];
            if (!path) return;

            let audio = sfxPool[path];
            if (!audio) {
                audio = new Audio(path);
                sfxPool[path] = audio;
            }

            // If already playing, rewind to the start
            if (!audio.paused) {
                audio.currentTime = 0;
            }

            audio.volume = volume;
            
            // Play safely handling the promise returned by modern browsers
            audio.play().catch(() => {
                // Ignore autoplay/user interaction errors silently
            });
        } catch (e) {
            console.warn("Could not play UI sound effect:", e);
        }
    }, []);

    return { playSound };
}
export type UseSoundReturn = ReturnType<typeof useSound>;
