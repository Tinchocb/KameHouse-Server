import { SegmentedControl } from "@/components/ui/segmented-control"
import { NAV_DENSITY_OPTIONS, type NavDensity } from "@/lib/nav-compact"
import { useUIStore } from "@/lib/store"

const DESCRIPTIONS: Record<NavDensity, string> = {
    auto: "Muestra solo los íconos al bajar la página y vuelve a mostrar los nombres al subir o al pasar el puntero.",
    expanded: "Muestra siempre los nombres de las secciones.",
    compact: "Muestra siempre solo los íconos. El nombre aparece al pasar el puntero o enfocar con el teclado.",
}

/**
 * Fila de Ajustes › Apariencia: "Barra de navegación". Es local (este dispositivo),
 * se aplica al instante y no necesita Guardar. Va dentro del bloque "Local" de
 * Apariencia, junto a "Desenfoque superior al desplazar".
 */
export function NavDensitySetting() {
    const density = useUIStore((s) => s.navDensity)
    const setNavDensity = useUIStore((s) => s.setNavDensity)

    return (
        <div className="flex flex-col gap-2 px-4 sm:px-5 py-3 sm:py-3.5">
            <div className="space-y-0.5">
                <p className="text-xs font-bold text-on-surface leading-snug">Barra de navegación</p>
                <p className="text-2xs text-label-2 leading-normal font-medium">{DESCRIPTIONS[density]}</p>
            </div>
            <SegmentedControl<NavDensity>
                aria-label="Barra de navegación"
                layoutId="settings-nav-density"
                options={NAV_DENSITY_OPTIONS}
                value={density}
                onChange={setNavDensity}
                surface="inset"
                labelStyle="sentence"
                fullWidth
            />
        </div>
    )
}
