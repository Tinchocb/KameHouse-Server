import "@total-typescript/ts-reset"
import type { DesktopSettings } from "@/lib/desktop-bridge"

declare global {
    interface AudioTrack {
        id: string;
        kind: string;
        label: string;
        language: string;
        enabled: boolean;
    }

    interface AudioTrackList extends EventTarget {
        readonly length: number;
        onchange: ((this: AudioTrackList, ev: Event) => void) | null;
        onaddtrack: ((this: AudioTrackList, ev: TrackEvent) => void) | null;
        onremovetrack: ((this: AudioTrackList, ev: TrackEvent) => void) | null;

        [index: number]: AudioTrack;

        getTrackById(id: string): AudioTrack | null;
    }

    interface HTMLMediaElement {
        readonly audioTracks: AudioTrackList | undefined;
    }

    export interface DesktopAPI {
        window: {
            minimize: () => void;
            maximize: () => void;
            close: () => void;
            isMaximized: () => Promise<boolean>;
            isMinimizable: () => Promise<boolean>;
            isMaximizable: () => Promise<boolean>;
            isClosable: () => Promise<boolean>;
            isFullscreen: () => Promise<boolean>;
            setFullscreen: (fullscreen: boolean) => void;
            toggleMaximize: () => void;
            hide: () => void;
            show: () => void;
            isVisible: () => Promise<boolean>;
            getCurrentWindow: () => Promise<string>;
            isMainWindow: () => Promise<boolean>;
        };
        localServer: {
            getPort: () => Promise<number>;
        };
        startup: {
            ready: () => void;
        };
        on: (channel: string, callback: (...args: unknown[]) => void) => (() => void) | undefined;
        platform: NodeJS.Platform;
        shell: {
            open: (url: string) => Promise<void>;
        };
        clipboard: {
            writeText: (text: string) => Promise<boolean>;
        };
        checkForUpdates: () => Promise<unknown>;
        installUpdate: () => Promise<unknown>;
        killServer: () => Promise<unknown>;
        settings: {
            get: () => Promise<DesktopSettings>;
            set: (settings: Partial<DesktopSettings>) => Promise<DesktopSettings>;
        };
        mpv: {
            isAvailable: () => Promise<boolean>;
            play: (request: {
                path: string;
                title?: string;
                startTime?: number;
                mediaId?: number;
                episodeNumber?: number;
            }) => Promise<void>;
            stop: () => Promise<void>;
        };
    }

    interface Window {
        desktop?: DesktopAPI;

        __isTauriDesktop__?: boolean;
        __TAURI__?: unknown;
        __TAURI_INTERNALS__?: unknown;
        __kamehouse_bg_audio?: HTMLAudioElement;
        __KAMEHOUSE_PORT__?: number | string;
    }
}