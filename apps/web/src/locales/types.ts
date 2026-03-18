/**
 * Explicit typed dictionary shape for all locales.
 * Using explicit `string` types (not inferred from `as const`) so each locale
 * can have different string values while still being fully type-checked.
 */
export interface LocaleDict {
    home: {
        empty: {
            title: string
            unmatchedTitle: string
            unmatchedDesc: string
            configureLibrary: string
            addSeries: string
            addCurrentlyWatching: string
            notWatching: string
            notWatchingDesc: string
        }
        error: {
            title: string
            desc: string
            retry: string
            resetLayout: string
        }
        stats: {
            library: string
            files: string
            entries: string
            tvShows: string
            movies: string
            specials: string
        }
    }
    toolbar: {
        localAnimeLibrary: string
        home: string
        libraryExplorer: string
        playlists: string
        addMissingExtensions: string
        noTorrentProviders: string
        openDirectory: string
        bulkActions: string
        ignoredFiles: string
    }
    modal: {
        homeItemAdded: string
        homeItemRemoved: string
        homeLayoutUpdated: string
        animeLibrarySection: string
        homeLayoutSection: string
        availableItemsSection: string
        noItemsYet: string
        allItemsAdded: string
        localAnimeOnly: string
        allWatchingIncluded: string
        configureItem: string
        cancel: string
        save: string
        add: string
        configure: string
    }
}
