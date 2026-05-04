export const Platform_OAUTH_URL = `https://Platform.co/api/v2/oauth/authorize?client_id=15168&response_type=token`
export const Platform_PIN_URL = `https://Platform.co/api/v2/oauth/authorize?client_id=13985&response_type=token`
export const MAL_CLIENT_ID = `51cb4294feb400f3ddc66a30f9b9a00f`

function parseDevApiPort(): number {
    const raw = import.meta.env.SEA_PUBLIC_DEV_API_PORT
    if (raw == null || raw === "") return 43211
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0 || n > 65535) return 43211
    return n
}

export const __DEV_SERVER_PORT = parseDevApiPort()
export const TESTONLY__DEV_SERVER_PORT2 = __DEV_SERVER_PORT
export const TESTONLY__DEV_SERVER_PORT3 = __DEV_SERVER_PORT
