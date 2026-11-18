/**
 * KameHouse 2.0 — Definición Centralizada de Tema: Clásico / Minimalista (Apple TV+)
 * 
 * Este archivo centraliza la configuración, metadatos, tokens y clases del tema
 * Clásico / Minimalista para que sea extremadamente fácil de modificar, personalizar o extender.
 */

export const CLASSIC_MINIMALIST_THEME = {
    id: "classic-minimalist" as const,
    name: "Minimalista",
    subtitle: "El arte en primer plano",
    description: "El arte en primer plano. Controles discretos y navegación sencilla.",
    stylesheet: "apps/web/src/styles/themes/classic-minimalist.css",
    
    /* Atributo declarativo montado en el elemento <html> */
    domAttribute: "data-ui-style",
    domValue: "classic-minimalist",

    /* Contrato completo de atributos declarativos en <html> */
    domContract: {
        mode: "classic" as const,
        theme: "classic" as const,
        uiStyle: "classic-minimalist" as const,
    },

    /* Paleta de referencia: espejo de los tokens --minimal-* de
       styles/themes/classic-minimalist/tokens.css, que es la fuente de verdad. */
    palette: {
        canvas: "#08080A",
        surface: "#141418",
        surfaceRaised: "#1A1A20",
        surfaceHover: "#24242A",
        accent: "#F5F5F7",
        accentHover: "#FFFFFF",
        onAccent: "#08080A",
        textPrimary: "#F5F5F7",
        textSecondary: "#C0C0C7",
        textMuted: "#9898A0",
        textPlaceholder: "#86868E",
    },

    /* Plano por diseño: resolveFlatReason devuelve "theme" y <html> lleva data-flat="true" */
    flat: true,

    /* Geometría y Proporciones */
    geometry: {
        buttonHeight: "46px",
        buttonHeightClass: "h-[46px]",
        buttonRadius: "12px",
        buttonRadiusClass: "rounded-xl",
        iconHitTarget: "46px",
        activeScale: 0.98,
    },

    /* Clases de utilidad para componentes */
    classes: {
        // Hero Spotlight
        spotlightPlayCta: "spotlight-play-cta",
        spotlightSagaChip: "spotlight-saga-chip",
        spotlightCard: "spotlight-hero-card",
        spotlightSagaCard: "spotlight-saga-card",

        // Fichas Multimedia y Serie
        detailMetaChip: "detail-meta-chip",
        detailRoundAction: "detail-round-action",
        mediaMetadataCapsule: "media-metadata-capsule",
        seriesHeroEraBadge: "series-hero-era-badge",
        moviesHeroEraBadge: "movies-hero-era-badge",
        seriesCollapsePill: "series-collapse-pill",
        seriesCollapseEpBadge: "series-collapse-ep-badge",
        seriesCollapseProgressFill: "series-collapse-progress-fill",
        watchProgressFill: "watch-progress-fill",

        // Selector de Sagas y Arcos
        sagaCollapsedActivePill: "saga-collapsed-active-pill",
        arcCardActiveIndicator: "arc-card-active-indicator",
        arcCardAccentBar: "arc-card-accent-bar",
        arcCardProgressFill: "arc-card-progress-fill",

        // Pestañas y Filtros
        segmentedControlRoot: "UI-SegmentedControl_root",
        segmentedControlOption: "UI-SegmentedControl_option",
        segmentedControlIndicator: "UI-SegmentedControl_indicator",

        // Barra de Navegación Flotante
        navIsland: "floating-nav-island",
        navActiveIndicator: "floating-nav-active-indicator",
        navQueueBadge: "floating-nav-queue-badge",

        // Catálogos, Pósters y Episodios
        moviePosterCard: "movie-poster-card",
        posterChip: "poster-chip",
        characterAvatarCard: "character-avatar-card",
        characterAvatarFrame: "character-avatar-frame",
        characterAvatarRole: "character-avatar-role",
        characterDetailModal: "character-detail-modal",
        episodePlayOverlay: "episode-play-overlay",
        episodeProgressBarFill: "episode-progress-bar-fill",
        episodeRowRedundantPlay: "episode-row-redundant-play",
        episodeBadgeWatched: "episode-badge-watched",
        episodeBadgeEp: "episode-badge-ep",
        episodeBadgeFiller: "episode-badge-filler",
        episodeActiveSubsagaBanner: "episode-active-subsaga-banner",
        episodeRowHighlighted: "episode-row-highlighted",

        // Cronología
        chronoChip: "chrono-chip",
        chronologyCompactRow: "chronology-compact-row",
        chronologyProgressBar: "chronology-progress-bar",
        chronoEraKanjiFrame: "chrono-era-kanji-frame",
        chronoEraKanjiBadge: "chrono-era-kanji-badge",
        chronoEraKanjiGlyph: "chrono-era-kanji-glyph",
        chronoClimaxBox: "chrono-climax-box",
        contralateralDetailsCard: "contralateral-details-card",
        volumeInspectorModal: "volume-inspector-modal",
        volumeNavGroup: "volume-nav-group",
        volumeScrubberFill: "volume-scrubber-fill",
        loreTermBadge: "lore-term-badge",
        scrollProgressBar: "scroll-progress-bar",

        // Formularios e Inputs Universales
        inputRoot: "UI-Input__root",
        modalContent: "UI-Modal__content",

        // Reproductor de Video
        playerHudCapsule: "player-hud-capsule",
        playerIconActive: "player-icon-active",
        playerSkipBtn: "player-skip-btn",
        playerNextEpBtn: "player-next-ep-btn",
        playerSeekFill: "player-seek-fill",
        playerSeekThumb: "player-seek-thumb",
        playerEyebrowText: "player-eyebrow-text",
        playerSkipBackBtn: "player-skip-back-btn",
        playerSkipFwdBtn: "player-skip-fwd-btn",
        playerSkipSeparator: "player-skip-separator",
        playerQueueBtn: "player-queue-btn",
        playerMpvBtn: "player-mpv-btn",
        playerMarathonBtn: "player-marathon-btn",
    },
} as const
