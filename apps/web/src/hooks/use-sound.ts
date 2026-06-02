import { useCallback } from "react";
import { useAppStore } from "@/lib/store";

// Static global pool to cache HTMLAudioElement instances and prevent GC thrashing
const sfxPool: Record<string, HTMLAudioElement> = {};

export type SfxType = 
    | "hover"    // /sounds/seleccion de hover.wav
    | "series"   // /sounds/serie.wav
    | "detail"   // /sounds/entrar detalle serie-peliculas.wav
    | "random"   // /sounds/serie-pelicula random.wav
    | "category"; // /sounds/cambiar categoria.wav

const SFX_PATHS: Record<SfxType, string> = {
    hover: "/sounds/seleccion de hover.wav",
    series: "/sounds/serie.wav",
    detail: "/sounds/entrar detalle serie-peliculas.wav",
    random: "/sounds/serie-pelicula random.wav",
    category: "/sounds/cambiar categoria.wav"
};

export function useSound() {
    const uiSoundsEnabled = useAppStore((state) => state.uiSoundsEnabled);

    const playSound = useCallback((type: SfxType, volume = 0.15) => {
        if (!uiSoundsEnabled) return;
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
    }, [uiSoundsEnabled]);

    return { playSound };
}
export type UseSoundReturn = ReturnType<typeof useSound>;
