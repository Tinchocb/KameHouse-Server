/**
 * Endpoints complementarios no generados automáticamente por OpenAPI/Go codegen.
 * Centraliza rutas para evitar el uso de strings literales dispersos.
 */
export const EXTRA_ENDPOINTS = {
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
    DIAGNOSTICS: {
        Report: {
            endpoint: "/api/v1/report",
            key: "diagnostics_report",
        },
    },
    BACKUP: {
        Download: {
            endpoint: "/api/v1/db/backup/download",
            key: "db_backup_download",
        },
    },
    LOGS: {
        Filenames: {
            endpoint: "/api/v1/logs/filenames",
            key: "logs_filenames",
        },
        ByName: {
            endpoint: "/api/v1/log",
            key: "logs_by_name",
        },
        Latest: {
            endpoint: "/api/v1/logs/latest",
            key: "logs_latest",
        },
        Delete: {
            endpoint: "/api/v1/logs",
            key: "logs_delete",
        },
    },
} as const
