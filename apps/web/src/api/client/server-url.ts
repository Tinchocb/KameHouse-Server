import { __DEV_SERVER_PORT, TESTONLY__DEV_SERVER_PORT2, TESTONLY__DEV_SERVER_PORT3 } from "@/lib/server/config"
import { __isDesktop__ } from "@/types/constants"

function devOrProd(dev: string, prod: string): string {
    return import.meta.env.MODE === "development" ? dev : prod
}

export function getServerBaseUrl(removeProtocol: boolean = false): string {
    if (__isDesktop__) {
        let ret = devOrProd(`http://127.0.0.1:${__DEV_SERVER_PORT}`, "http://127.0.0.1:43211")
        if (removeProtocol) {
            ret = ret.replace("http://", "").replace("https://", "")
        }
        return ret
    }

    // For standard web environments (dev proxy or production self-hosted),
    // relative paths are preferred because the server and client share an origin.
    // If removeProtocol is explicitly requested, we shouldn't return an empty string if we need a host,
    // but typically removeProtocol implies an absolute host.
    // However, returning "" implies absolute path `/api/v1/...` which the browser resolves correctly.
    if (import.meta.env.MODE === "development") {
        return ""
    }

    let ret = typeof window !== "undefined"
        ? (devOrProd("", "")) // Use relative implicitly for web
        : ""
    return ret
}
