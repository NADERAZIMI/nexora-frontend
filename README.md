# NEXORA frontend

Single-page Spot Trading visual prototype built with React, TypeScript, and Vite.

## Run locally

```sh
npm ci
npm run dev
```

Preview: http://127.0.0.1:5271/

## Production build

```sh
npm run build
```

TypeScript checks run before Vite creates the production bundle in `dist/`.

## Source and assets

- `src/main.tsx`: React entry point and local prototype interactions.
- `src/snapshot.html`: preserved trading page markup with local BTC/USDT mock data.
- `src/reference.css`: original page styles and embedded fonts.
- `src/palette.css`: approved NEXORA colors.
- `src/fidelity.css`: native-size viewport adjustments without global zoom or scaling.
- `public/nexora-logo.png`: official, unmodified NEXORA logo.
- Other `public/` images: required static chart and market assets.

The page has no backend, authentication service, exchange APIs, WebSockets, or real trading execution. The chart is static; unsupported actions display a local prototype notice. Inactive panels not present in the saved source remain unavailable.

The current layout was checked at 1920×1080, 1600×900, 1440×900, and 1366×768 at normal browser zoom. Backgrounds use #080808 for the application and #101014 for secondary panels.

Reference captures, screenshots, local verification scripts, dependencies, and generated build output are intentionally excluded from version control.
