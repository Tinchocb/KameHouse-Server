/// <reference types="@rsbuild/core/types" />

interface ImportMetaEnv {
    readonly SEA_APP_TITLE: string
    readonly SEA_PUBLIC_PLATFORM: string
    readonly SEA_PUBLIC_DESKTOP: string
    /** Puerto del API en dev (inyectado por rsbuild desde KAMEHOUSE_DEV_API_PORT / KAMEHOUSE_PORT). */
    readonly SEA_PUBLIC_DEV_API_PORT: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
