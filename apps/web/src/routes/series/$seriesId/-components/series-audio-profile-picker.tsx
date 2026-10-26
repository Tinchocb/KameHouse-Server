import { useMediaAudioProfiles, useSetMediaAudioProfile } from "@/api/hooks/media_audio.hooks"
import { IconMediaVolume2 } from "@/components/ui/icons"
import { cn } from "@/components/ui/core/styling"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { usePlayerStore } from "@/lib/store"
import { audioProfileOptions, seriesAudioProfileValue, type AudioProfileChoice } from "./series-audio-profile"

/**
 * Perfil de audio de la serie: Global (el de Ajustes), Latino, Castellano, Japonés,
 * Inglés o Automático mostrado en siglas compactas. Se guarda en el servidor, así que
 * aplica en todos los clientes la próxima vez que se reproduce un episodio.
 */
export function SeriesAudioProfilePicker({ mediaId, className }: { mediaId: number | undefined; className?: string }) {
    const { data: profiles } = useMediaAudioProfiles()
    const { mutate: setProfile, isPending } = useSetMediaAudioProfile()
    const globalProfile = usePlayerStore(state => state.preferredAudioProfile)
    const setPreferredAudioTrackIndex = usePlayerStore(state => state.setPreferredAudioTrackIndex)

    if (!mediaId) return null

    const current = seriesAudioProfileValue(profiles, mediaId)
    const options = audioProfileOptions(globalProfile)

    const choose = (value: AudioProfileChoice | "") => {
        if (value === current || isPending) return
        // Elegir un perfil reemplaza la pista que se hubiera elegido a mano en esta serie:
        // si no, esa elección seguiría ganando sobre el perfil y el cambio no se notaría.
        setPreferredAudioTrackIndex(mediaId, -1)
        setProfile({ mediaId, audioProfile: value })
    }

    return (
        <section
            aria-label="Idioma de audio de la serie"
            className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}
        >
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <IconMediaVolume2 className="h-4 w-4 text-brand-accent" aria-hidden />
                <span className="font-medium text-on-surface">Audio</span>
                <span className="text-xs text-on-surface-variant">· se aplica al reproducir</span>
            </div>

            <SegmentedControl<string>
                aria-label="Perfil de audio de la serie"
                layoutId={`seriesAudio-${mediaId}`}
                semantics="radiogroup"
                surface="inset"
                labelStyle="caps"
                value={current}
                options={options.map(opt => ({
                    value: opt.value,
                    label: opt.label,
                    ariaLabel: opt.ariaLabel,
                    disabled: isPending,
                }))}
                onChange={value => choose(value as AudioProfileChoice | "")}
            />
        </section>
    )
}
