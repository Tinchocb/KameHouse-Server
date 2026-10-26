import { describe, it, expect } from "vitest"
import { SPAN_VOLUMES, groupVolumesBySaga, groupVolumesByEra, compareInUniverse, formatYearShort } from "./spansToVolumes"
import { VOLUMES_DATA } from "./volumes"

describe("Chronology spans -> volumes (70 lapsos)", () => {
  it("exposes 70 lapso volumes in global order", () => {
    expect(VOLUMES_DATA.length).toBe(70)
    expect(SPAN_VOLUMES.length).toBe(70)
    const orders = SPAN_VOLUMES.map((v) => v.order ?? 0)
    expect(orders).toEqual(Array.from({ length: 70 }, (_, i) => i + 1))
  })

  it("keeps episode ranges contiguous within each series", () => {
    const bySeries = new Map<string, typeof SPAN_VOLUMES>()
    for (const v of SPAN_VOLUMES) {
      const key = v.seriesId ?? "?"
      const existing = bySeries.get(key)
      if (existing) {
        existing.push(v)
      } else {
        bySeries.set(key, [v])
      }
    }
    expect(bySeries.get("classic")?.length).toBe(16)
    expect(bySeries.get("z")?.length).toBe(28)
    expect(bySeries.get("super")?.length).toBe(15)
    expect(bySeries.get("daima")?.length).toBe(4)
    expect(bySeries.get("gt")?.length).toBe(7)
  })

  it("groups volumes by saga (27 saga groups)", () => {
    const groups = groupVolumesBySaga(SPAN_VOLUMES)
    expect(groups.length).toBe(27)
    const superGroups = groups.filter((g) => g.seriesId === "super")
    expect(superGroups.map((g) => g.sagaId)).toContain("copy-vegeta")
    expect(superGroups.map((g) => g.sagaId)).toContain("exhibicion-zen")
    const gtGroups = groups.filter((g) => g.seriesId === "gt")
    expect(gtGroups.length).toBe(4)
  })

  it("enriches every lapso with narrative fallbacks", () => {
    for (const v of SPAN_VOLUMES) {
      expect(v.title).toBeTruthy()
      expect(v.sagaLabel).toBeTruthy()
      expect(v.episodesCount).toBeGreaterThan(0)
      expect(v.detailedStory).toBeDefined()
      expect(v.detailedStory?.episodeMilestones.length).toBeGreaterThan(0)
    }
  })

  it("compareInUniverse deja a Daima después de dbz-buu-mundo-en-paz y antes de dbs-dioses-llegada, y los años quedan no decrecientes", () => {
    const sorted = [...SPAN_VOLUMES].sort(compareInUniverse)
    expect(sorted.length).toBe(70)

    const finalBuuIndex = sorted.findIndex((v) => v.id === "dbz-buu-mundo-en-paz")
    const daima1Index = sorted.findIndex((v) => v.id === "db-daima-conspiracion")
    const daimaLastIndex = sorted.findIndex((v) => v.id === "db-daima-climax")
    const godsIndex = sorted.findIndex((v) => v.id === "dbs-dioses-llegada")

    expect(finalBuuIndex).toBeGreaterThan(-1)
    expect(daima1Index).toBe(finalBuuIndex + 1)
    expect(godsIndex).toBe(daimaLastIndex + 1)

    // Los años oficiales quedan no decrecientes
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].officialYearNumber).toBeGreaterThanOrEqual(sorted[i - 1].officialYearNumber)
    }
  })

  it("groupVolumesByEra sobre la lista ordenada da 5 eras en el orden Clásico, Z, Daima, Super, GT", () => {
    const sorted = [...SPAN_VOLUMES].sort(compareInUniverse)
    const eras = groupVolumesByEra(sorted)

    expect(eras.length).toBe(5)
    expect(eras.map((e) => e.seriesId)).toEqual(["classic", "z", "daima", "super", "gt"])
    expect(eras[0].sagas.length).toBeGreaterThan(0)
    expect(eras[1].sagas.length).toBeGreaterThan(0)
    expect(eras[2].sagas.length).toBeGreaterThan(0)
    expect(eras[3].sagas.length).toBeGreaterThan(0)
    expect(eras[4].sagas.length).toBeGreaterThan(0)
  })

  it("formatYearShort formatea correctamente los rangos", () => {
    expect(formatYearShort("Año 749 – 750")).toBe("749–750")
    expect(formatYearShort("Año 749 - 750")).toBe("749–750")
    expect(formatYearShort("Año 753")).toBe("753")
  })
})
