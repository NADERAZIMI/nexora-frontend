# NEXORA — Phase 02E Hotfix: Single-Side Order Book Layout

Date: 2026-10-20. Starting revision: `d424a86b3f82b50e7372ad151b9869693cf964fb`, confirmed equal to fetched `origin/main` before changes.

## Cause and correction

Phase 02E used `visibility:hidden`, so the excluded Ask/Bid section retained its captured 189px height. The mid-price also retained its inline `height:calc(100% - 406px)`, which assumes the two captured side sections. Hiding data alone preserved the wrong single-side geometry.

The correction is confined to single-side modes:

- Excluded side uses `display:none`, removing its layout slot while retaining every node in the DOM. Existing `aria-hidden` state stays synchronized by the unchanged selection handler.
- The Order Book content body uses a local flex column. The visible Ask/Bid section is first, directly beneath the original column headers. Its nine captured rows retain their original ordering, values, 21px pitch and original dimensions.
- A scoped CSS variable aligns single-side content to the measured header bottom. The captured `top:94px` otherwise overlaps the header by 9px in the tested viewport. A `ResizeObserver` on this book/header keeps that boundary synchronized on size changes and is disconnected during cleanup. Combined never uses the variable.
- The existing mid-price readout follows the visible section directly. Its obsolete two-side height calculation is overridden with natural content height in single-side modes, avoiding a detached separator or gap. It remains visible in every mode.
- The existing B/S depth proportion follows the mid-price with its original styling and margin. Explicit flex order prevents it from inserting a 28px block between visible rows and the mid-price.
- Combined mode matches none of the new layout rules, so its original section positions, inline heights, mid-price layout and both row groups are restored exactly.

Only nine captured rows exist per side. Any remaining unused panel area sits below the compact rows and mid-price, not in a reserved opposite-side slot or above the visible data. Rows are not stretched, copied, fabricated or rewritten to fill that area. The Order Book's outer width/height, chart, trading forms and other panels remain unchanged.

Mouse, Enter, Space, selected visual class, accessible pressed/hidden state, local mode persistence across notices and scoped event handlers remain as implemented in Phase 02E. TypeScript only adds the single-side header-boundary variable/resize observer and its cleanup, plus an updated layout comment; no selection behavior changed.

## Changed files

| File | Change |
| --- | --- |
| `src/prototype.css` | Replace reserved visibility slots with mode-scoped collapsed exclusion and compact row/mid-price layout. No global layout or scaling rules. |
| `src/orderbook-display.ts` | Keep the scoped content-top variable synchronized with the actual header boundary, disconnect the resize observer during cleanup, and update the explanatory comment. Selection logic unchanged. |
| `tests/spot-controls.test.mjs` | Update the former test assumption that side/mid-price rectangles never move. Continue checking outer geometry, typography, content and controls, and add a dedicated placement/restoration test. |
| `tests/baseline.json` | Update only reviewed hashes for the two files above and record `phase02eHotfixReviewedFrom`. |
| `reports/SPOT-PHASE-02E-HOTFIX.md` | This report. |

All other frozen hashes, including source for Buy/Sell/slider/checkbox, main mounting code, reference/layout/palette CSS, archived snapshot, authoritative raw HTML, logo and assets, are unchanged. Dependencies and configuration are unchanged.

## Verification

All earlier functional coverage is retained. The Order Book geometry test now protects outer panels/controls/inputs while the new test explicitly verifies the intentionally changed internal geometry:

- Buy Only and Sell Only each collapse the excluded section to zero width/height with computed `display:none`.
- Visible section starts at the content body's top immediately beneath the headers; first-row offset, row pitch, dimensions and sampled text styles match the original.
- Mid-price is visible directly at the visible section's bottom, has natural content height and stays inside the content body.
- Repeated returns to Combined restore the complete original measurement set. Removing only the mode attribute in Combined produces the same placement, proving the new layout rules do not affect the captured Combined CSS.
- Existing tests continue checking mouse/keyboard/ARIA state, all 18 row-node identities and outer HTML/values/order, surrounding geometry, prior controls, notices and exact theme tokens.

Browser verification uses actual DOM rectangles at 1440×900 and default browser scale, without screenshots or image-derived measurements. No external HTTP or trading transport is introduced. The isolated test server leaves the user's preview port alone; build output remains ignored.

| Final verification | Result |
| --- | --- |
| `npm test` with `SPOT_BROWSER_CHANNEL=msedge` | PASS: 20 tests, 0 failures, 0 skipped, 0 TODO; 57.01 seconds. |
| `npm run typecheck` | PASS: TypeScript `--noEmit`. |
| `npm run build` | PASS: TypeScript plus Vite 7.3.7; 34 modules, 9.22 seconds. |
| Actual single-side placement | PASS: excluded side has zero layout rectangle; visible rows begin below headers, with original dimensions/pitch; mid-price is visible immediately after them. |
| Combined/outer geometry | PASS: complete Combined measurement set restores; panel and adjacent chart/form dimensions stay unchanged. |
| Content/state integrity | PASS: original nodes/values/order retained, prior mouse/keyboard/ARIA and local controls pass; unchanged source/reference/assets match baseline hashes. |
| Browser errors/external HTTP | No page exceptions or external HTTP attempts during the suite. |

The new placement test initially exposed the captured header overlap, then the depth split's default flex order inserting a 28px gap before mid-price. Both were corrected within single-side scope and the focused test plus final full suite passed. Verification ran outside the established Windows restrictions for headless Edge/Vite. `git diff --check` passed; no unresolved failing requirement remains within this hotfix scope.

## Limitations and stopping point

This corrects presentation of captured data only. No additional depth, aggregation/precision, settings, row-click trading, APIs, backend, WebSocket, calculations, new pages or account functionality is added. Headless Edge is tested; physical devices, assistive technology and other browser engines are not separately verified. Authoritative HTML and approved theme/logo are unchanged. Phase 02F is not started.
