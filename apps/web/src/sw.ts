/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

const CACHE_CONFIG = {
  googleFonts: {
    stylesheets: { name: 'google-fonts-stylesheets' },
    webfonts: { name: 'google-fonts-webfonts', maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
  },
  wasm: { name: 'wasm-decoders-cache', maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 },
  api: { name: 'api-metadata-cache', maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
} as const;

function createCacheablePlugin(statuses: number[]) {
  return new CacheableResponsePlugin({ statuses });
}

function createExpirationPlugin(maxEntries: number, maxAgeSeconds: number) {
  return new ExpirationPlugin({ maxEntries, maxAgeSeconds });
}

// Google Fonts - Stylesheets (StaleWhileRevalidate)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: CACHE_CONFIG.googleFonts.stylesheets.name })
);

// Google Fonts - Webfonts (CacheFirst)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: CACHE_CONFIG.googleFonts.webfonts.name,
    plugins: [
      createCacheablePlugin([0, 200]),
      createExpirationPlugin(CACHE_CONFIG.googleFonts.webfonts.maxEntries, CACHE_CONFIG.googleFonts.webfonts.maxAgeSeconds),
    ],
  })
);

// WASM Decoder Modules (CacheFirst, immutable)
registerRoute(
  ({ request }) => request.url.endsWith('.wasm'),
  new CacheFirst({
    cacheName: CACHE_CONFIG.wasm.name,
    plugins: [
      createCacheablePlugin([0, 200]),
      createExpirationPlugin(CACHE_CONFIG.wasm.maxEntries, CACHE_CONFIG.wasm.maxAgeSeconds),
    ],
  })
);

// OPFS (Origin Private File System) - Initialization for media chunks
// Caching media chunks in OPFS is disabled due to backpressure/audio desync issues with pipeTo on cloned streams.
// See commented block in src/sw.ts for reference implementation.
let opfsRoot: FileSystemDirectoryHandle | null = null;
const OPFS_CHUNK_DIR_NAME = 'media_chunks';

async function initOPFS() {
  try {
    if (!navigator.storage || !navigator.storage.getDirectory) {
      console.warn('OPFS is not supported, falling back to standard cache');
      return;
    }
    opfsRoot = await navigator.storage.getDirectory();
    await opfsRoot.getDirectoryHandle(OPFS_CHUNK_DIR_NAME, { create: true });
  } catch {
    console.error('Failed to initialize OPFS');
  }
}

// API Metadata Requests (NetworkFirst)
registerRoute(
  ({ request, url }) =>
    url.pathname.startsWith('/api/') &&
    !url.pathname.includes('/mediastream/') &&
    !url.pathname.includes('/video-thumbnail') &&
    request.method === 'GET',
  new NetworkFirst({
    cacheName: CACHE_CONFIG.api.name,
    plugins: [
      createCacheablePlugin([200]),
      createExpirationPlugin(CACHE_CONFIG.api.maxEntries, CACHE_CONFIG.api.maxAgeSeconds),
    ],
  })
);

// Listen to skip waiting message from app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Init OPFS immediately when SW boots
initOPFS();