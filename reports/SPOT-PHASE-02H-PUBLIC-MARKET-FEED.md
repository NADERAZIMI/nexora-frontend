# Phase 02H — Public MEXC Spot Market Data (Experimental Frontend Only)

Scope: `nexora-frontend` only. No NEXORA backend or trading engine is altered. No keys, account endpoints, signed calls or order placement.

Implemented:
- Development-only Vite proxy `/mexc-public` to public `https://api.mexc.com`; does not deploy a production proxy.
- Public Spot discovery with exchangeInfo and ticker/price.
- Per-selected-symbol public `/api/v3/depth` and `/api/v3/klines` (1 minute) read-only requests; 15s refresh, abort on symbol changes/cleanup.
- Canvas candlesticks drawn from verified OHLC; mouse wheel zoom of visible bars. Fixed archived chart covered only when a feed is selected.
- Ask/bid orderbook rows replaced with public snapshot price/quantity values. "Total" is deliberately shown as — pending explicit definition of cumulative calculations; no fabrication.
- Non-BTC instrument chart and depth no longer blocked by static-snapshot availability mask. Trade form remains disabled when selecting another symbol.

Caveats:
- Endpoints are real public REST endpoints but actual runtime API reachability/market access depends on user network, MEXC geo-policy and proxy support.
- REST polling is not a WebSocket stream. The chart is a minimal Canvas implementation, not a full trading chart; saved chart timeframe toolbar is not yet connected to it.
- Historical archive data for BTC/SHIDO/WOJAK is not live; the source is never presented as authenticated trading availability.
- Tests/typecheck/build have NOT been run in the local Windows checkout by this GitHub-only implementation. Treat behavior as experimental pending browser smoke tests.
- Do not copy this Vite development proxy to the independent NEXORA backend.
