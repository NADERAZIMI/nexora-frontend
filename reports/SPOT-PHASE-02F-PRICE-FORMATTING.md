# NEXORA — Phase 02F: Exact Tiny-Price Display

Date: 2026-10-20. Base revision: c4d13a58996c478eead2f24329661364ad9d0d25.

## Sources inspected
- User-supplied saved MEXC SHIDO_USDT SingleFile, 2026-10-20 07:16:50 +0330. Mid-price: 0.0000786, dropdown: 0.0000001, nine asks and nine bids.
- User-supplied saved MEXC WOJAK_USDT SingleFile, 2026-10-20 07:14:26 +0330. Mid-price: 0.0{7}4276 (equal to 0.00000004276), dropdown: 0.0{10}1 (equal to 0.00000000001), nine asks and nine bids.
- Current archived NEXORA BTC_USDT prototype: selected precision 0.01. Reference TRX_USDT SingleFile: selected precision 0.0001.

These are captured display values, not evidence of the full instrument precision dropdown option lists or live tick-size rules. The SingleFile titles include stale BTC metadata on MEXC alternate symbols: source URLs and DOM market names are authoritative for identifying the samples, not the document title.

## Implementation
- New src/price-precision.ts: string/BigInt-based decimal parser, reversible compact zero-run expansion, automatic formatting when at least five zeros lead the fractional nonzero digits, and exact unit tick generation for 0 through 30 decimal places.
- Handles grouped BTC-like prices, SHIDO seven-place values, and WOJAK tiny values without Number conversion or scientific notation. Preserves source trailing fractional zeros. Rejects invalid input and unsupported precision.
- Orderbook presentation module now applies this formatter to actual captured ask/bid price text nodes only when normalization is needed; it does not replace row nodes, fabricate prices, alter size/volume/total cells or change the market.
- Existing precision dropdown stays strictly scoped to the captured BTC 0.01 choice until instrument-specific options and raw depth data are available. No synthetic aggregation/tick selection is introduced.
- Added browser-based regression test cases covering BTC, SHIDO, WOJAK, grouped/negative/trailing-zero formats, exact ticks, compact expansion and invalid input. Updated integrity baseline for changed/new source files.

## Limitations and verification
These changes provide the shared price formatting foundation for future instrument selection/market adapters, but the running page is still the archived BTC/USDT snapshot; it cannot switch to SHIDO/WOJAK or fetch live exchange data. No backend or market feed is connected. A menu with additional precision choices and actual grouped depth rows will require approved market metadata and raw depth levels.

Code committed directly to GitHub. No local project checkout, dependencies or browser runner available in this environment, so Playwright/typecheck/build have NOT been executed here. Do not interpret added tests as passing until CI or local run confirms.
