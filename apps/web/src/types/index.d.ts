import type { DesktopAPI } from "@/lib/desktop-bridge"

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

    interface Window {
        desktop?: DesktopAPI;

        __isTauriDesktop__?: boolean;
        __TAURI__?: unknown;
        __TAURI_INTERNALS__?: unknown;
        __kamehouse_bg_audio?: HTMLAudioElement;
        __kamehouse_bg_audio_outgoing?: HTMLAudioElement;
        __KAMEHOUSE_PORT__?: number | string;
        /** Loader estático de index.html: texto de estado y progreso monótono (0..1). */
        khLoader?: { set: (text?: string, progress?: number) => void };

        requestIdleCallback?: (callback: (deadline: IdleDeadline) => void, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
    }
}
