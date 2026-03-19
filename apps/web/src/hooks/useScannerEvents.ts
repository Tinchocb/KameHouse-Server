import { useEffect } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useAppStore } from "@/lib/store";
import { WSEvents, type ScannerMessage } from "@/lib/server/ws-events";
import { toast } from "sonner";
import { getServerBaseUrl } from "@/api/client/server-url";

export function useScannerEvents() {
    const { setScanning, setScanProgress, setScanningFile } = useAppStore();

    const wsUrl = (() => {
        const base = getServerBaseUrl();
        if (base === "") {
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            return `${protocol}//${window.location.host}/api/v1/ws`;
        }
        if (base.startsWith("http://")) return base.replace("http://", "ws://") + "/api/v1/ws";
        if (base.startsWith("https://")) return base.replace("https://", "wss://") + "/api/v1/ws";
        return "ws://127.0.0.1:43211/api/v1/ws";
    })();

    useWebSocket(wsUrl, (eventData) => {
        if (!eventData || typeof eventData !== "object" || eventData.type !== WSEvents.LIBRARY_SCAN) return;
        
        const data = eventData.payload as ScannerMessage;

        switch (data.status) {
            case "START":
                setScanning(true);
                setScanProgress(0);
                setScanningFile("");
                toast.info("Iniciando escaneo de biblioteca...", {
                    id: "library-scan-toast",
                    duration: Infinity,
                });
                break;

            case "PROCESSING": {
                const total = data.total || 0;
                const current = data.current || 0;
                const progress = total > 0 ? Math.min((current / total) * 100, 100) : 0;
                
                setScanProgress(progress);
                if (data.file) {
                    setScanningFile(data.file);
                }
                break;
            }

            case "PRUNED": {
                // Stage 6: files deleted from disk were removed from the DB
                const removed = data.removed ?? 0;
                if (removed > 0) {
                    toast.info(`Limpieza completada: ${removed} archivo${removed !== 1 ? "s" : ""} eliminado${removed !== 1 ? "s" : ""} de la biblioteca.`, {
                        id: "library-scan-prune-toast",
                        duration: 4000,
                    });
                }
                break;
            }

            case "FINISH":
                setScanning(false);
                setScanProgress(100);
                toast.dismiss("library-scan-toast");

                const totalProcessed = data.total_processed ?? 0;
                const durSec = data.duration_seconds ?? 0;
                const durLabel = durSec > 60
                    ? `${Math.round(durSec / 60)}m ${Math.round(durSec % 60)}s`
                    : `${durSec.toFixed(1)}s`;

                toast.success(
                    totalProcessed > 0
                        ? `Escaneo completado — ${totalProcessed} archivo${totalProcessed !== 1 ? "s" : ""} en ${durLabel}`
                        : "Escaneo completado sin cambios",
                    { id: "library-scan-toast", duration: 5000 }
                );
                
                // Wait 3 seconds, then reset progress to 0
                setTimeout(() => {
                    setScanProgress(0);
                    setScanningFile("");
                }, 3000);
                break;
        }
    });
}
