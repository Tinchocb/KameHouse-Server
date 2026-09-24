---
name: fixing-metadata
description: Auditoría y optimización de metadata HTML, Open Graph, Twitter Cards, PWA y Tauri para KameHouse.
---

# Fixing Metadata (KameHouse Edition)

Guía para auditar, estandarizar y enriquecer la metadata en KameHouse (`apps/web`), cubriendo `index.html`, manifiestos de PWA, compatibilidad con Tauri y rutas dinámicas en TanStack Router.

## 1. Metadata Base en `index.html`

Verificar que `apps/web/index.html` mantenga:

```html
<!-- Codificación y viewport -->
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />

<!-- Color de tema sincronizado con tokens de fondo -->
<meta name="theme-color" content="#09090b" />
<meta name="color-scheme" content="dark" />

<!-- Título y descripción por defecto -->
<title>KameHouse</title>
<meta name="description" content="Servidor multimedia personal y cinemático para anime y series." />

<!-- Capacidades PWA / iOS Web App -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="KameHouse" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="format-detection" content="telephone=no" />
```

## 2. Open Graph y Twitter Cards

Para cuando la interfaz se comparte por web, Discord o mensajería:

```html
<!-- Open Graph -->
<meta property="og:site_name" content="KameHouse" />
<meta property="og:type" content="website" />
<meta property="og:title" content="KameHouse — Servidor Multimedia" />
<meta property="og:description" content="Servidor multimedia personal y cinemático para anime y series." />
<meta property="og:image" content="/backdrops/db.webp" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="KameHouse — Servidor Multimedia" />
<meta name="twitter:description" content="Servidor multimedia personal y cinemático para anime y series." />
<meta name="twitter:image" content="/backdrops/db.webp" />
```

## 3. Metadata Dinámica con TanStack Router

En rutas específicas (`/movies`, `/series/$seriesId`, `/chronology`), definir la metadata contextual usando la propiedad `head` de la ruta:

```tsx
export const Route = createFileRoute('/series/$seriesId')({
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? 'Serie'} — KameHouse` },
      { name: 'description', content: loaderData?.overview ?? 'Detalles y episodios en KameHouse.' },
      { property: 'og:title', content: `${loaderData?.title ?? 'Serie'} — KameHouse` },
      { property: 'og:image', content: loaderData?.posterUrl ?? '/backdrops/db.webp' },
    ],
  }),
  // ...
});
```

## 4. Checklist de Auditoría

1. [ ] **Viewport**: ¿Incluye `viewport-fit=cover` para soportar safe-areas en iPhone/iPad?
2. [ ] **Theme Color**: ¿Coincide `#09090b` con el fondo primario `--bg-primary`?
3. [ ] **Iconos**: ¿Están presentes `favicon-32x32.png`, `apple-touch-icon.png` y `manifest.json`?
4. [ ] **Preloads críticos**: ¿Solo se precargan fuentes o assets LCP (como `backdrops/db.webp`) con `fetchpriority="high"`?
5. [ ] **PWA Manifest**: ¿Tiene `display: "standalone"`, `background_color: "#09090b"`, y orientaciones permitidas?
