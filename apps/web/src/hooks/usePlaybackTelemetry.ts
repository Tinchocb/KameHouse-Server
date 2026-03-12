import { useRef, useEffect } from "react";

export function usePlaybackTelemetry(
    mediaId?: number | string,
    episodeNumber?: number | string,
    videoRef?: React.RefObject<HTMLVideoElement | null>
) {
    const lastSyncTimeRef = useRef(0);

    useEffect(() => {
        if (!videoRef || !videoRef.current || !mediaId || !episodeNumber) return;

        const video = videoRef.current;

        const sendSyncTick = (isFinal: boolean) => {
            const currentTime = video.currentTime;
            const duration = video.duration || 0;

            if (!isFinal && currentTime === lastSyncTimeRef.current) {
                return;
            }

            lastSyncTimeRef.current = currentTime;

            const payload = JSON.stringify({
                mediaId: Number(mediaId),
                episodeNumber: Number(episodeNumber),
                currentTime,
                duration,
                progress: duration > 0 ? currentTime / duration : 0,
            });

            const endpoint = "/api/v1/playback/sync";

            if (isFinal) {
                const blob = new Blob([payload], { type: "application/json" });
                if (!navigator.sendBeacon(endpoint, blob)) {
                    fetch(endpoint, {
                        method: "POST",
                        body: payload,
                        headers: { "Content-Type": "application/json" },
                        keepalive: true,
                    }).catch(() => {});
                }
            } else {
                fetch(endpoint, {
                    method: "POST",
                    body: payload,
                    headers: { "Content-Type": "application/json" },
                }).catch(() => {});
            }
        };

        // 1. Periodic Sync (5 seconds)
        const intervalId = setInterval(() => sendSyncTick(false), 5000);

        // 2. Event Listeners for immediate sync
        const handleInteractionSync = () => sendSyncTick(false);
        video.addEventListener("pause", handleInteractionSync);
        video.addEventListener("seeked", handleInteractionSync);

        // 3. Unload Guarantee
        const handleUnload = () => sendSyncTick(true);
        window.addEventListener("beforeunload", handleUnload);

        return () => {
            clearInterval(intervalId);
            video.removeEventListener("pause", handleInteractionSync);
            video.removeEventListener("seeked", handleInteractionSync);
            window.removeEventListener("beforeunload", handleUnload);
            
            // Fire one last tick upon unmount
            sendSyncTick(true);
        };
    }, [mediaId, episodeNumber, videoRef]);
}
