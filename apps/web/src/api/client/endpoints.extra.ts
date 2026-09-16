/**
 * Endpoints complementarios no generados automáticamente por OpenAPI/Go codegen.
 * Centraliza rutas para evitar el uso de strings literales dispersos.
 */
export const EXTRA_ENDPOINTS = {
    CAST: {
        GetDevices: {
            endpoint: "/api/v1/cast/devices",
            key: "cast_devices",
        },
        Play: {
            endpoint: "/api/v1/cast/play",
            key: "cast_play",
        },
    },
    DRAGONBALL: {
        Lore: {
            endpoint: "/api/v1/lore/dragonball",
            key: "dragonball_lore",
        },
    },
    MEDIASTREAM: {
        SkipTimes: {
            endpoint: "/api/v1/mediastream/skip-times",
            key: "mediastream_skip_times",
        },
        ResolveMal: {
            endpoint: "/api/v1/mediastream/skip-times/resolve-mal",
            key: "mediastream_resolve_mal",
        },
        FFmpegStatus: {
            endpoint: "/api/v1/mediastream/ffmpeg/status",
            key: "mediastream_ffmpeg_status",
        },
        InstallFFmpeg: {
            endpoint: "/api/v1/mediastream/ffmpeg/install",
            key: "mediastream_ffmpeg_install",
        },
    },
    INTELLIGENCE: {
        Search: {
            endpoint: "/api/v1/intelligence/search",
            key: "intelligence_search",
        },
    },
} as const
