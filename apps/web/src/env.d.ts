/// <reference types="@rsbuild/core/types" />
import "./types/index.d.ts";

interface ImportMetaEnv {
    readonly MODE: "development" | "production" | "test"
    readonly DEV: boolean
    readonly KAMEHOUSE_PUBLIC_PLATFORM?: string
    /** Puerto del API en dev (inyectado por rsbuild desde KAMEHOUSE_DEV_API_PORT / KAMEHOUSE_PORT). */
    readonly KAMEHOUSE_PUBLIC_DEV_API_PORT?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
