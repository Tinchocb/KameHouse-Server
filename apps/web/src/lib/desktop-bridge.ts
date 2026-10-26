import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const getAppWindow = () => {
  if (isTauri()) {
    try {
      return getCurrentWindow();
    } catch {
      return null;
    }
  }
  return null;
};

const getPlatform = (): NodeJS.Platform => {
  if (typeof process !== 'undefined' && process.platform) {
    return process.platform;
  }
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) return 'win32';
    if (ua.includes('mac')) return 'darwin';
    if (ua.includes('linux')) return 'linux';
  }
  return 'win32';
};

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
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  platform: NodeJS.Platform;
  shell: {
    open: (url: string) => Promise<void>;
  };
  clipboard: {
    writeText: (text: string) => Promise<boolean>;
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
    window: {
      minimize: () => {
        getAppWindow()?.minimize().catch(console.error);
      },
      maximize: () => {
        getAppWindow()?.maximize().catch(console.error);
      },
      close: () => {
        getAppWindow()?.close().catch(console.error);
      },
      isMaximized: async () => {
        const win = getAppWindow();
        return win ? await win.isMaximized() : false;
      },
      isMinimizable: async () => {
        const win = getAppWindow();
        return win ? await win.isMinimizable() : false;
      },
      isMaximizable: async () => {
        const win = getAppWindow();
        return win ? await win.isMaximizable() : false;
      },
      isClosable: async () => {
        const win = getAppWindow();
        return win ? await win.isClosable() : false;
      },
      isFullscreen: async () => {
        const win = getAppWindow();
        return win ? await win.isFullscreen() : false;
      },
      setFullscreen: (fullscreen: boolean) => {
        getAppWindow()?.setFullscreen(fullscreen).catch(console.error);
      },
      toggleMaximize: async () => {
        try {
          const win = getAppWindow();
          if (win) {
            const maximized = await win.isMaximized();
            if (maximized) {
              await win.unmaximize();
            } else {
              await win.maximize();
            }
          }
        } catch (e) {
          console.warn('[Bridge] toggleMaximize failed:', e);
        }
      },
      hide: () => {
        getAppWindow()?.hide().catch(console.error);
      },
      show: () => {
        const win = getAppWindow();
        if (win) {
          win.show().catch(console.error);
          win.setFocus().catch(console.error);
        }
      },
      isVisible: async () => {
        const win = getAppWindow();
        return win ? await win.isVisible() : true;
      },
      getCurrentWindow: async () => {
        return getAppWindow()?.label || 'main';
      },
      isMainWindow: async () => {
        return (getAppWindow()?.label || 'main') === 'main';
      },
    },
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
    platform: getPlatform(),
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
    clipboard: {
      writeText: async (text: string) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(text);
            return true;
          } catch (e) {
            console.error('[Bridge] Clipboard write failed:', e);
            return false;
          }
        }
        return false;
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