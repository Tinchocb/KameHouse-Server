export function registerTizenKeys() {
  try {
    if (typeof (window as any).tizen !== 'undefined' && (window as any).tizen.tvinputdevice) {
      const keys = ['VolumeUp', 'VolumeDown', 'VolumeMute', 'Play', 'Pause', 'PlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'];
      keys.forEach(k => {
        try {
          (window as any).tizen.tvinputdevice.registerKey(k);
        } catch (e) {}
      });
    }
  } catch (e) {}
}

export function exitTizenApp() {
  try {
    if (typeof (window as any).tizen !== 'undefined' && (window as any).tizen.application) {
      (window as any).tizen.application.getCurrentApplication().exit();
    }
  } catch (e) {}
}

export function getTizenLocalIP(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (typeof (window as any).tizen !== 'undefined' && (window as any).tizen.systeminfo) {
        (window as any).tizen.systeminfo.getPropertyValue("WIFI_NETWORK", (wifi: any) => {
          if (wifi && wifi.ipAddress) {
            resolve(wifi.ipAddress);
          } else {
            tryEthernet();
          }
        }, () => tryEthernet());
      } else {
        resolve(null);
      }
    } catch (e) {
      resolve(null);
    }

    function tryEthernet() {
      try {
        (window as any).tizen.systeminfo.getPropertyValue("ETHERNET_NETWORK", (eth: any) => {
          if (eth && eth.ipAddress) {
            resolve(eth.ipAddress);
          } else {
            resolve(null);
          }
        }, () => resolve(null));
      } catch (e) {
        resolve(null);
      }
    }
  });
}

