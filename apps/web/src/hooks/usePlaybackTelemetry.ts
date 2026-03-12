import { useRef, useEffect } from "react";

export function usePlaybackTelemetry(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    mediaId?: number | string,
    episodeNumber?: number | string
) {
    const lastSyncTimeRef = useRef(0);

    useEffect(() => {
        if (!videoRef.current || !mediaId || !episodeNumber) return;

        const sendSyncTick = (isFinal: boolean) => {
            const video = videoRef.current;
            if (!video) return;

            const currentTime = video.currentTime;
            const duration = video.duration || 0;
            const isPaused = video.paused;

            // Only sync if video is playing/progressed or it's a final unload tick
            if (!isFinal && (isPaused || currentTime === lastSyncTimeRef.current)) {
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

        // Fire heartbeat every 10 seconds
        const intervalId = setInterval(() => sendSyncTick(false), 10000);

        const handleUnload = () => sendSyncTick(true);
        window.addEventListener("beforeunload", handleUnload);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener("beforeunload", handleUnload);
            // Fire one last tick upon unmount (e.g. user hits "Back")
            sendSyncTick(true);
        };
    }, [mediaId, episodeNumber, videoRef]);
}
