import * as React from "react"
import { ERAS, ERA_COLOR_MAP, type EraId } from "@/lib/config/eras"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import { EraRail, ERA_AIR_YEARS, pluralize, type EraRailItem } from "@/components/ui/era-rail"
import { useIsMinimalistMode } from "@/lib/theme/use-classic-mode"

interface SpotlightEraNavProps {
    activeEraId: EraId | "all"
    categorizedData: Record<EraId, { series: SwimlaneItem | null; movies: SwimlaneItem[] }>
    onSelectEra: (eraId: EraId | "all") => void
    onHoverSound?: () => void
    showAllOption?: boolean
}

/** Nombre completo en sentence case (el `shortTitle` de ERAS es una sigla: "DB Original"). */
const ERA_LABELS: Record<EraId, string> = {
    db: "Dragon Ball",
    dbz: "Dragon Ball Z",
    dbgt: "Dragon Ball GT",
    dbkai: "Dragon Ball Kai",
    dbs: "Dragon Ball Super",
    dbdaima: "Dragon Ball Daima",
}



/**
 * Selector de era de Inicio y Películas. Envoltorio fino de `EraRail`: solo traduce los datos
 * categorizados (series y películas por era) a los ítems del riel.
 */
export const SpotlightEraNav = React.memo(function SpotlightEraNav({
    activeEraId,
    categorizedData,
    onSelectEra,
    onHoverSound,
    showAllOption = false,
}: SpotlightEraNavProps) {
    const isMinimalist = useIsMinimalistMode()
    const eras = React.useMemo(() => {
        const list: EraRailItem<EraId | "all">[] = []
        const perEra = ERAS.map((era) => {
            const data = categorizedData[era.id]
            return { era, count: (data?.series ? 1 : 0) + (data?.movies?.length ?? 0) }
        })
        const total = perEra.reduce((sum, e) => sum + e.count, 0)

        if (showAllOption) {
            list.push({
                id: "all",
                label: "Todas las eras",
                kanji: "全",
                accent: "var(--label-1)",
                badge: String(total),
                detail: pluralize(total, "título", "títulos"),
                disabled: total === 0,
            })
        }
        for (const { era, count } of perEra) {
            list.push({
                id: era.id,
                label: ERA_LABELS[era.id],
                kanji: era.kanji,
                accent: ERA_COLOR_MAP[era.id].accent,
                years: ERA_AIR_YEARS[era.id] ?? String(era.year),
                badge: count > 0 ? String(count) : undefined,
                detail: count > 0 ? pluralize(count, "título", "títulos") : undefined,
                disabled: isMinimalist ? false : count === 0,
            })
        }
        return list
    }, [categorizedData, showAllOption, isMinimalist])

    return (
        <EraRail
            eras={eras}
            activeId={activeEraId}
            onSelect={onSelectEra}
            onItemHover={onHoverSound}
            label="Eras de Dragon Ball"
        />
    )
})
