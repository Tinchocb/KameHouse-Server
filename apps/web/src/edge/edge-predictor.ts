/**
 * Edge Predictor Function (Cloudflare Workers / Vercel Edge compatible)
 * Intercepts client playback beacons to asynchronously pre-warm the Go Hybrid Orchestrator.
 */

// Cloudflare Workers basic type definitions for local TS compiler
declare global {
    interface KVNamespace {
        get(key: string): Promise<string | null>;
        put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
    }
    interface ExecutionContext {
        waitUntil(promise: Promise<any>): void;
    }
}

export interface Env {
    // Cloudflare KV binding for sub-10ms global deduplication
    PREDICTOR_KV: KVNamespace;
    // The internal routing URL for the Go backend (e.g. https://api.kamehouse.com)
    GO_BACKEND_URL: string;
    // Shared secret to validate requests
    BEACON_SECRET: string;
}

interface BeaconPayload {
    userId: string;
    mediaId: string;
    currentEpisode: number;
    progressPercentage: number;
}

export default {
    /**
     * Web Fetch API handler optimized for Sub-10ms cold starts.
     */
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // 1. Validate the incoming request method and endpoint structure
        if (request.method !== "POST" || !new URL(request.url).pathname.endsWith("/beacon")) {
            return new Response("Method not allowed", { status: 405 });
        }

        // 2. Validate Authorization
        const auth = request.headers.get("Authorization");
        if (auth !== `Bearer ${env.BEACON_SECRET}`) {
            return new Response("Unauthorized", { status: 401 });
        }

        // 3. Parse JSON Beacon (Fast failure if invalid)
        let payload: BeaconPayload;
        try {
            payload = (await request.json()) as BeaconPayload;
        } catch {
            return new Response("Invalid JSON", { status: 400 });
        }

        const { userId, mediaId, currentEpisode, progressPercentage } = payload;

        // 4. Threshold Check (Only trigger pre-hydration if user crossed 85% of the video)
        if (progressPercentage < 85) {
            // Acknowledge the beacon but take no action yet.
            return new Response("OK - Ignored (Under threshold)", { status: 200 });
        }

        const nextEpisode = currentEpisode + 1;
        const cacheKey = `prewarm:${userId}:${mediaId}:${nextEpisode}`;

        // 5. Global Deduplication using Edge KV
        // Check if we already scheduled the orchestrator warming for this user/episode.
        const alreadyWarmed = await env.PREDICTOR_KV.get(cacheKey);
        if (alreadyWarmed) {
            return new Response("OK - Already pre-warmed", { status: 200 });
        }

        // Mark as warmed immediately with a 24-hour expiration TTL to prevent duplicate fires.
        await env.PREDICTOR_KV.put(cacheKey, "true", { expirationTtl: 86400 });

        // 6. Asynchronous Background Execution
        // We use ctx.waitUntil() to instruct the Edge runtime NOT to kill the sandbox
        // after we return the HTTP 202 to the user. This ensures true zero-latency for the client.
        ctx.waitUntil(triggerGoOrchestrator(env.GO_BACKEND_URL, mediaId, nextEpisode));

        // 7. Instant Response (Sub-10ms exit)
        return new Response(JSON.stringify({ status: "PRE_WARM_INITIATED" }), {
            status: 202,
            headers: {
                "Content-Type": "application/json",
                // Disable any intermediary caching for the beacon
                "Cache-Control": "no-store",
            }
        });
    }
};

/**
 * Fires the heavy backend orchestration logic without waiting for the response stream.
 * The Go backend will scrape Torrentio/Debrid and write into the DB/Redis cache.
 */
async function triggerGoOrchestrator(backendUrl: string, mediaId: string, targetEpisode: number): Promise<void> {
    const orchestratorEndpoint = `${backendUrl}/api/v1/stream/resolve/${mediaId}?ep=${targetEpisode}&prewarm=true`;

    try {
        const response = await fetch(orchestratorEndpoint, {
            method: "GET",
            headers: {
                "User-Agent": "Antigravity-Edge-Predictor",
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            console.error(`[Edge Predictor] Backend failed to pre-warm ${mediaId} ep ${targetEpisode}: ${response.status}`);
        }

    } catch (e) {
        // Fail silently in production since this is a background optimization process
        console.error(`[Edge Predictor] Network failure contacting Go backend:`, e);
    }
}
