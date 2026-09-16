/// <reference types="@rsbuild/core/types" />
import "./types/index.d.ts";

interface ImportMetaEnv {
    readonly MODE: "development" | "production" | "test"
    readonly DEV: boolean
    readonly PROD: boolean
    readonly SEA_APP_TITLE: string
    readonly SEA_PUBLIC_PLATFORM: string
    readonly SEA_PUBLIC_DESKTOP: string
    /** Puerto del API en dev (inyectado por rsbuild desde KAMEHOUSE_DEV_API_PORT / KAMEHOUSE_PORT). */
    readonly SEA_PUBLIC_DEV_API_PORT: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
