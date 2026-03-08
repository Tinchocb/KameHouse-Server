/**
 * P2PMeshEngine.ts
 * 
 * A zero-dependency WebRTC Service Worker Interceptor/MSE Wrapper
 * for decentralized video chunk delivery on the Antigravity Player.
 */

export class P2PMeshEngine {
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private dataChannels: Map<string, RTCDataChannel> = new Map();
    private episodeHash: string;

    // Strict 200ms SLA for chunk retrieval
    private readonly CHUNK_TIMEOUT_MS = 200;

    constructor(episodeHash: string) {
        this.episodeHash = episodeHash;
        this.initializeSwarm();
    }

    /**
     * Connects to the signaling server to discover peers watching the exact same episodeHash.
     */
    private initializeSwarm(): void {
        console.log(`[P2PMesh] Joining Swarm for hash: ${this.episodeHash}`);
        // In a real implementation: Connect to a lightweight WebSocket signaling server.
        // Once connected, exchange SDP offers/answers and ICE candidates to establish `peerConnections`.
        // We ensure data channels are negotiated out-of-band:
        // const channel = pc.createDataChannel("chunkDelivery", { ordered: true });
    }

    /**
     * The primary interceptor function. 
     * Called by the MSE (MediaManager) or Service Worker fetch event before asking the backend.
     */
    public async fetchChunk(chunkIndex: number, expectedManifestHash: string): Promise<ArrayBuffer | null> {
        return new Promise((resolve) => {
            const timeoutTimer = setTimeout(() => {
                console.warn(`[P2PMesh] Swarm Timeout (${this.CHUNK_TIMEOUT_MS}ms) for chunk ${chunkIndex}. Falling back to Debrid/Server HTTP.`);
                resolve(null); // Yield back control to fallback mechanism
            }, this.CHUNK_TIMEOUT_MS);

            // Broadcast request to all connected peers
            const requestPayload = JSON.stringify({ type: 'WANT_CHUNK', index: chunkIndex });

            if (this.dataChannels.size === 0) {
                clearTimeout(timeoutTimer);
                return resolve(null); // No peers, instant fallback
            }

            let resolved = false;

            this.dataChannels.forEach((channel, peerId) => {
                if (channel.readyState === 'open' && !resolved) {
                    // Send request
                    channel.send(requestPayload);

                    // Listen for incoming ArrayBuffer
                    channel.onmessage = async (event) => {
                        if (resolved) return;

                        if (event.data instanceof ArrayBuffer) {
                            // FAST VERIFICATION: Web Crypto API (SubtleCrypto) SHA-256
                            const isValid = await this.verifyIntegrity(event.data, expectedManifestHash);

                            if (isValid) {
                                resolved = true;
                                clearTimeout(timeoutTimer);
                                console.log(`[P2PMesh] Chunk ${chunkIndex} downloaded from Peer ${peerId.slice(0, 4)} via WebRTC.`);
                                resolve(event.data);
                            } else {
                                console.error(`[P2PMesh] Security Alert: Peer ${peerId} sent a corrupted chunk. Terminating connection.`);
                                this.banPeer(peerId);
                            }
                        }
                    };
                }
            });
        });
    }

    /**
     * Securely validates the requested chunk against the verified manifest checksum.
     */
    private async verifyIntegrity(buffer: ArrayBuffer, expectedHashHex: string): Promise<boolean> {
        try {
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const actualHashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            return actualHashHex === expectedHashHex;
        } catch (e) {
            return false;
        }
    }

    /**
     * Banish peers sending corrupted bytes to protect the swarm.
     */
    private banPeer(peerId: string): void {
        const pc = this.peerConnections.get(peerId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(peerId);
            this.dataChannels.delete(peerId);
        }
    }

    /**
     * Gracefully destroy the mesh engine on component unmount
     */
    public destroy(): void {
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        this.dataChannels.clear();
    }
}
