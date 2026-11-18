import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface DesktopAPI {
  localServer: {
    getPort: () => Promise<number>;
  };
  startup: {
    ready: () => void;
  };
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  shell: {
    open: (url: string) => Promise<void>;
  };
  logs: {
    /** Abre la carpeta de registros en el explorador del sistema. */
    openFolder: () => Promise<void>;
  };
  mpv: {
    isAvailable: () => Promise<boolean>;
    play: (request: MpvPlayRequest) => Promise<void>;
    stop: () => Promise<void>;
  };
}

interface MpvPlayRequest {
  /** Absolute file path (or URL) that mpv will open. */
  path: string;
  title?: string;
  startTime?: number;
  mediaId?: number;
  episodeNumber?: number;
}

const isTauri = () => {
  try {
    return (
      typeof window !== 'undefined' &&
      (!!window.__TAURI__ ||
        typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined')
    );
  } catch {
    return false;
  }
};

function createTauriBridge(): DesktopAPI {
  return {
    startup: {
      ready: () => {
        if (isTauri()) {
          invoke('startup_renderer_ready').catch(console.error);
        }
      },
    },
    on: (channel: string, callback: (...args: unknown[]) => void) => {
      // In browser mode, we don't have IPC
      if (!isTauri()) {
        return () => {};
      }

      // Convert IPC channels to Tauri events
      let unlisten: (() => void) | undefined;
      let isCancelled = false;
      
      listen(channel, (event) => {
        callback(event.payload);
      }).then((unlistenFn) => {
        if (isCancelled) {
          unlistenFn();
        } else {
          unlisten = unlistenFn;
        }
      }).catch(console.error);

      return () => {
        isCancelled = true;
        if (unlisten) {
          unlisten();
        }
      };
    },
    localServer: {
      getPort: async () => {
        if (isTauri()) {
          try {
            return await invoke<number>('get_local_server_port');
          } catch {
            return 0;
          }
        }
        return 0;
      },
    },
    shell: {
      open: async (url: string) => {
        if (isTauri()) {
          try {
            await invoke('shell_open', { url });
          } catch (e) {
            console.error('[Bridge] Shell open failed:', e);
          }
        }
      },
    },
    logs: {
      openFolder: async () => {
        if (isTauri()) {
          await invoke('open_logs_folder');
        }
      },
    },
    mpv: {
      isAvailable: async () => {
        if (isTauri()) {
          try {
            return await invoke<boolean>('mpv_is_available');
          } catch (e) {
            console.error('[Bridge] mpv availability check failed:', e);
            return false;
          }
        }
        return false;
      },
      play: async (request: MpvPlayRequest) => {
        if (!isTauri()) throw new Error('mpv solo está disponible en la app de escritorio');
        await invoke('mpv_play', { request });
      },
      stop: async () => {
        if (isTauri()) {
          try {
            await invoke('mpv_stop');
          } catch (e) {
            console.error('[Bridge] mpv stop failed:', e);
          }
        }
      },
    },
  };
}

if (typeof window !== 'undefined') {
  const bridge = createTauriBridge();
  window.desktop = bridge;

  if (isTauri()) {
    window.__isTauriDesktop__ = true;
  } else {
    window.__isTauriDesktop__ = false;
  }
}