# NEXORA frontend

Clean React 19 + TypeScript + Vite rewrite of the Bybit-inspired NEXORA Spot interface. Replaces the saved SingleFile HTML snapshot, rather than injecting its DOM. Components include market header, chart area, order-book container, spot order form and order history. Uses the NEXORA dark color palette and embedded NEXORA logo.

This initial React conversion contains **no live API/WebSocket connections or trade execution**. Order Book and chart intentionally display waiting states. Next step: read-only Bybit Spot WebSocket order-book integration.

Development: `npm ci && npm run dev` | Production: `npm run build`.
