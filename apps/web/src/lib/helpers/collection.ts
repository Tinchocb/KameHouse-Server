import type { Anime_LibraryCollection, Anime_LibraryCollectionEntry } from "@/api/generated/types"

/**
 * Aplana `collection.lists[].entries` filtrando huecos nulos.
 *
 * El backend serializa `[]*Entry` de Go: un `nil` llega como `null` en JSON,
 * y cualquier `entry.media` posterior revienta con
 * "Cannot read properties of null (reading 'media')".
 * Centralizar el compactado evita repetir el guard en cada vista.
 */
export function getSafeCollectionEntries(
    collection: Anime_LibraryCollection | null | undefined,
): Anime_LibraryCollectionEntry[] {
    if (!collection?.lists) return []
    return collection.lists.flatMap((list) => list?.entries ?? []).filter(
        (e): e is Anime_LibraryCollectionEntry => e != null,
    )
}
