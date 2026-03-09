/**
 * components/video/player.tsx
 *
 * Public re-export facade for the Stremio-style VideoPlayerModal.
 *
 * Import from this path for all future consumer code so the internal
 * component location can be refactored without touching import sites.
 *
 * Usage:
 *   import { VideoPlayer, type VideoPlayerProps } from "@/components/video/player"
 *
 * Features (implemented in VideoPlayerModal):
 *   - HLS.js for transcode/optimized .m3u8 streams
 *   - Direct play for local MKV/MP4 via native <video>
 *   - Auto-hiding controls (mouse-idle 3 s)
 *   - Keyboard shortcuts: Space/K (play/pause) · F (fullscreen) · M (mute) · ←/→ (±10 s)
 *   - Double-click/tap zones: left third −10 s, right third +10 s
 *   - Center Stremio-flash overlay on play/pause
 *   - localStorage resume — saves every 5 s, restores on load
 *   - JASSUB WASM renderer for .ass / .ssa anime subtitles (offscreen canvas)
 *   - Audio + subtitle track selection via PlayerSettingsMenu
 *   - Playback telemetry + continuity tracking
 */
export {
    VideoPlayerModal as VideoPlayer,
    type VideoPlayerModalProps as VideoPlayerProps,
} from "@/components/ui/video-player-modal"
