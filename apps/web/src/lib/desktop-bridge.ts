import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
import { check } from '@tauri-apps/plugin-updater';
import { open } from '@tauri-apps/plugin-opener';

const appWindow = getCurrentWindow();
let pendingUpdate: any = null;

declare global {
  interface Window {
    electron: ElectronAPI;
    __isElectronDesktop__: boolean;
    __isTauriDesktop__: boolean;
  }
}

export interface ElectronAPI {
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
    setTitleBarStyle: (style: string) => void;
    getCurrentWindow: () => Promise<number>;
    isMainWindow: () => Promise<boolean>;
  };
  startup: {
    ready: () => void;
  };
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  emit: (channel: string, data?: unknown) => void;
  send: (channel: string, ...args: unknown[]) => void;
  platform: NodeJS.Platform;
  clipboard: {
    writeText: (text: string) => Promise<boolean>;
  };
  checkForUpdates: () => Promise<{ updateAvailable: boolean; updateInfo: unknown; updateDownloaded: boolean }>;
  installUpdate: () => Promise<boolean>;
  killServer: () => Promise<boolean>;
  settings: {
    get: () => Promise<DesktopSettings>;
    set: (settings: Partial<DesktopSettings>) => Promise<DesktopSettings>;
  };
}

export interface DesktopSettings {
  minimizeToTray: boolean;
  openInBackground: boolean;
  openAtLaunch: boolean;
  updateChannel: string;
  windowBounds: WindowBounds | null;
  windowMaximized: boolean;
  disableHardwareAcceleration: boolean;
  enableAggressiveGpuFlags: boolean;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const isTauri = () => {
  try {
    return typeof window !== 'undefined' && !!window.__TAURI__;
  } catch {
    return false;
  }
};

const isElectron = () => {
  try {
    return typeof window !== 'undefined' && !!window.electron && !window.__TAURI__;
  } catch {
    return false;
  }
};

function createElectronBridge(): ElectronAPI {
  const unsubscribeMap = new Map<string, () => void>();

  return {
    window: {
      minimize: () => {
        if (isTauri()) {
          appWindow.minimize().catch(console.error);
        }
      },
      maximize: () => {
        if (isTauri()) {
          appWindow.maximize().catch(console.error);
        }
      },
      close: () => {
        if (isTauri()) {
          appWindow.close().catch(console.error);
        }
      },
      isMaximized: async () => {
        if (isTauri()) {
          return await appWindow.isMaximized();
        }
        return false;
      },
      isMinimizable: async () => {
        if (isTauri()) {
          return await appWindow.isMinimizable();
        }
        return false;
      },
      isMaximizable: async () => {
        if (isTauri()) {
          return await appWindow.isMaximizable();
        }
        return false;
      },
      isClosable: async () => {
        if (isTauri()) {
          return await appWindow.isClosable();
        }
        return false;
      },
      isFullscreen: async () => {
        if (isTauri()) {
          return await appWindow.isFullscreen();
        }
        return false;
      },
      setFullscreen: (fullscreen: boolean) => {
        if (isTauri()) {
          appWindow.setFullscreen(fullscreen).catch(console.error);
        }
      },
      toggleMaximize: async () => {
        if (isTauri()) {
          const maximized = await appWindow.isMaximized();
          if (maximized) {
            await appWindow.unmaximize();
          } else {
            await appWindow.maximize();
          }
        }
      },
      hide: () => {
        if (isTauri()) {
          appWindow.hide().catch(console.error);
        }
      },
      show: () => {
        if (isTauri()) {
          appWindow.show().catch(console.error);
          appWindow.setFocus().catch(console.error);
        }
      },
      isVisible: async () => {
        if (isTauri()) {
          return await appWindow.isVisible();
        }
        return false;
      },
      setTitleBarStyle: (_style: string) => {
        // Not applicable in Tauri
      },
      getCurrentWindow: async () => {
        if (isTauri()) {
          const label = appWindow.label;
          return label === 'main' ? 1 : 2;
        }
        return 0;
      },
      isMainWindow: async () => {
        if (isTauri()) {
          return appWindow.label === 'main';
        }
        return false;
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
      if (isTauri()) {
        const unsubscribe = listen(channel, (event) => {
          callback(event.payload);
        });
        unsubscribeMap.set(channel, unsubscribe);
        return () => {
          unsubscribe.then((fn) => fn());
          unsubscribeMap.delete(channel);
        };
      }
      return () => {};
    },
    emit: (_channel: string, _data?: unknown) => {
      // In Tauri, we use listen/emit from the frontend directly
      // This is for compatibility with electron.emit() calls
    },
    send: (channel: string, ...args: unknown[]) => {
      if (isTauri()) {
        switch (channel) {
          case 'restart-server':
            invoke('restart_server').catch(console.error);
            break;
          case 'kill-server':
            invoke('kill_server').catch(console.error);
            break;
          case 'macos-activation-policy-accessory':
            // Not applicable in Tauri
            break;
          case 'macos-activation-policy-regular':
            // Not applicable in Tauri
            break;
          case 'quit-app':
            invoke('kill_server').then(() => {
              // App will exit via sidecar shutdown
            }).catch(console.error);
            break;
          case 'restart-app':
            // Not directly supported, would need custom handling
            break;
        }
      }
    },
    platform: process.platform,
    clipboard: {
      writeText: async (text: string) => {
        if (isTauri()) {
          try {
            await writeText(text);
            return true;
          } catch (e) {
            console.error('[Bridge] Clipboard write failed:', e);
            return false;
          }
        }
        return false;
      },
    },
    checkForUpdates: async () => {
      if (isTauri()) {
        try {
          const update = await check();
          pendingUpdate = update;
          return {
            updateAvailable: !!update,
            updateInfo: update ? { version: update.version } : null,
            updateDownloaded: false, // Tauri doesn't separate download state
          };
        } catch (e) {
          console.error('[Bridge] Check updates failed:', e);
          return { updateAvailable: false, updateInfo: null, updateDownloaded: false };
        }
      }
      return { updateAvailable: false, updateInfo: null, updateDownloaded: false };
    },
    installUpdate: async () => {
      if (isTauri()) {
        try {
          if (pendingUpdate) {
            await pendingUpdate.downloadAndInstall();
            return true;
          }
          return false;
        } catch (e) {
          console.error('[Bridge] Install update failed:', e);
          return false;
        }
      }
      return false;
    },
    killServer: async () => {
      if (isTauri()) {
        try {
          await invoke('kill_server');
          return true;
        } catch (e) {
          console.error('[Bridge] Kill server failed:', e);
          return false;
        }
      }
      return false;
    },
    settings: {
      get: async () => {
        if (isTauri()) {
          try {
            return await invoke('get_desktop_settings');
          } catch (e) {
            console.error('[Bridge] Get settings failed:', e);
            return {
              minimizeToTray: true,
              openInBackground: false,
              openAtLaunch: false,
              updateChannel: 'github',
              windowBounds: null,
              windowMaximized: true,
              disableHardwareAcceleration: false,
              enableAggressiveGpuFlags: false,
            };
          }
        }
        return {
          minimizeToTray: true,
          openInBackground: false,
          openAtLaunch: false,
          updateChannel: 'github',
          windowBounds: null,
          windowMaximized: true,
          disableHardwareAcceleration: false,
          enableAggressiveGpuFlags: false,
        };
      },
      set: async (settings: Partial<DesktopSettings>) => {
        if (isTauri()) {
          try {
            const updates: Record<string, unknown> = {};
            if (settings.minimizeToTray !== undefined) updates.minimizeToTray = settings.minimizeToTray;
            if (settings.openInBackground !== undefined) updates.openInBackground = settings.openInBackground;
            if (settings.openAtLaunch !== undefined) updates.openAtLaunch = settings.openAtLaunch;
            if (settings.updateChannel !== undefined) updates.updateChannel = settings.updateChannel;
            if (settings.windowBounds !== undefined) updates.windowBounds = settings.windowBounds;
            if (settings.windowMaximized !== undefined) updates.windowMaximized = settings.windowMaximized;
            if (settings.disableHardwareAcceleration !== undefined) updates.disableHardwareAcceleration = settings.disableHardwareAcceleration;
            if (settings.enableAggressiveGpuFlags !== undefined) updates.enableAggressiveGpuFlags = settings.enableAggressiveGpuFlags;
            return await invoke('set_desktop_settings', { updates });
          } catch (e) {
            console.error('[Bridge] Set settings failed:', e);
            throw e;
          }
        }
        throw new Error('Not running in Tauri');
      },
    },
  };
}

if (typeof window !== 'undefined') {
  if (isTauri()) {
    window.__isTauriDesktop__ = true;
    window.__isElectronDesktop__ = false;
    window.electron = createElectronBridge();
    console.log('[Desktop Bridge] Tauri bridge initialized');
  } else if (isElectron()) {
    window.__isElectronDesktop__ = true;
    window.__isTauriDesktop__ = false;
    console.log('[Desktop Bridge] Running in Electron (no bridge needed)');
  } else {
    window.__isElectronDesktop__ = false;
    window.__isTauriDesktop__ = false;
    window.electron = createElectronBridge();
    console.log('[Desktop Bridge] Running in browser (mock bridge)');
  }
}

export { isTauri, isElectron };