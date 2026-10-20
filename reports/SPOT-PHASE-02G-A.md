# NEXORA — Phase 02G-A: Captured Market Preview

Base: d0dd93b86a6ec1826b36b074a230af4a2d1ef950

## Implemented
- Captured market registry: archived BTC/USDT plus user-provided SHIDO/USDT and WOJAK/USDT SingleFile sample values. Each explicitly labeled archived/offline, never live quotes or authoritative minimum order ticks.
- Clicking the existing BTC/USDT pair heading opens a compact scoped sample picker displaying each market's exact historical price and precision without replacing the active BTC snapshot.
- Keyboard Enter/Space/Escape, aria-expanded, aria-pressed, outside-click dismissal and listener disposal.
- Correct source preservation: chart, orderbook, trading forms and visible selected BTC instrument are unchanged, since corresponding live market/depth feeds are not yet available.
- Regression test added for sample selection and unchanged BTC orderbook; integrity baseline updated for all affected source paths.

## Important limitations
This is Phase 02G-A, an honest *sample preview*, not genuine pair switching. Real pair selection requires market snapshots or verified APIs for price, depth, ticker and chart. No invented depth or market activity. Tests and production build were not run in an instrumented browser/Node checkout by this GitHub-only tool environment; their result must not be reported as passing.

## Remaining
02G-B: source-backed pair switching using instrument market data and verified depth snapshots/feeds. Do not blindly copy BTC orderbook/chart under another symbol.
