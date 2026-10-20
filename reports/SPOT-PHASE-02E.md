# NEXORA Spot Trading — Phase 02E

Date: 2026-10-20. Starting revision: `d077dfc12f6fadeea80f52c4b4d9e63bf50cd822`. Fetched `origin/main` and confirmed the requested starting revision matched local `HEAD`. Reviewed the Phase 02A–02D reports and the existing 16-test suite.

## Implemented display contract

The three captured controls are identified by their existing icons within the Order Book panel:

| Mode / accessible button name | Captured icon | Visible data |
| --- | --- | --- |
| `combined` / Combined Buy + Sell | `IconOrderbookUpgreen` | All nine Ask rows and nine Bid rows. Default. |
| `buy` / Buy Only | `IconOrderbookBuy` | The same nine Bid rows; Ask contents hidden. |
| `sell` / Sell Only | `IconOrderbookSell` | The same nine Ask rows; Bid contents hidden. |

The existing icon spans retain their DOM, SVG artwork, dimensions, spacing and original active CSS class. Each becomes a focusable `role=button` with an explicit accessible name, `tabindex=0` and `aria-pressed=true/false`, within a named `Order Book display mode` group. Click, focused Enter and focused Space select a mode; Space does not scroll the page, key repeats are ignored, and reselecting the current mode is idempotent. Exactly one control has the active class and pressed state at all times.

`data-local-orderbook-mode=combined|buy|sell` on the existing panel is the authoritative local presentation state. Runtime hooks `data-local-orderbook-control` identify each control. Reattachment retains a valid existing mode; fresh page load defaults to Combined. Listeners are attached directly to the three scoped control elements and removed by the existing React effect cleanup. Nested SVG/path clicks work; unrelated lookalike elements are not intercepted.

## Geometry and data preservation

Single-side modes use scoped `visibility:hidden` on the excluded side section and set that section's `aria-hidden=true`. Its original height and position remain reserved. This intentionally leaves the excluded side's slot blank instead of inventing an expanded single-side layout, moving the mid-price or adding rows. Switching back to Combined removes the visibility rule through state selection and restores both sections to `aria-hidden=false`.

No row is deleted, recreated, reordered or rewritten. All original values, row markup, bar transforms, row heights and section dimensions remain intact. The mid-price, column labels, depth split, book size, adjacent chart and Spot form do not move. No screenshot or image-derived scaling was used. Original active-control styling and all approved color tokens are retained; no new selection colors were invented.

The display policy is applied to side containers, not captured row arrays or numeric text. Future rows rendered within the same Ask/Bid containers inherit the active visibility policy without re-binding each row. A future renderer replacing the entire panel/containers must explicitly reattach the helper and preserve/reapply the mode contract. This is presentation compatibility only: no live feed, data schema, sequencing/reconnection logic or integration is implemented.

## Changed files and reviewed hashes

| File | Change |
| --- | --- |
| `src/orderbook-display.ts` | New narrowly scoped display-mode helper, accessible state, local mode selection and listener cleanup. |
| `src/main.tsx` | Attach/dispose the helper in the existing snapshot effect. No other handler changes. |
| `src/prototype.css` | A scoped visibility rule for the two excluded side states. No sizing, typography, spacing, color or global layout rules. |
| `tests/spot-controls.test.mjs` | Append three Order Book tests; all 16 existing tests and assertions remain unchanged. |
| `tests/baseline.json` | Update reviewed hashes only for `src/main.tsx` and `src/prototype.css`; add the new helper's hash and `phase02eReviewedFrom` metadata. |
| `reports/SPOT-PHASE-02E.md` | This report. |

All other baseline entries, including `src/spot-local-controls.ts`, archived snapshot, authoritative raw HTML hash, layout/reference/palette CSS, logo, index and assets, remain unchanged. Dependencies and configuration are unchanged.

## Regression verification

Three new Playwright tests cover:

1. All three modes by mouse, Enter and Space, repeated selection, exactly one active/pressed control, accessible names/roles, Tab traversal, Space without scroll, correct visible Ask/Bid counts and side ARIA state. Original row node identity, outer HTML, values and ordering are checked throughout repeated Combined restoration.
2. Unchanged surrounding panel/control/input/section/mid-price geometry, typography, padding and borders across modes; retained mid-price/depth readouts; unchanged Buy/Sell, Price/Total, slider, checkbox and Market-tab state. Modes survive unrelated notices. Row clicks still do not fill fields; Deposit remains the unsupported-service action.
3. Nested icon clicks, scoped handlers, listener disposal, reattachment preserving mode, and original row-node retention on a detached clone of existing captured DOM. The clone is not rendered and adds no market data to the application.

All earlier controls retain their existing tests. Browser tests use default browser scale at 1440×900 with an isolated ephemeral Vite server; the user's preview on port 5271 is left alone. External HTTP attempts and page exceptions fail tests. Build output is ignored.

| Final verification | Result |
| --- | --- |
| `npm test` with `SPOT_BROWSER_CHANNEL=msedge` | PASS: 19 tests, 0 failures, 0 skipped, 0 TODO; all 16 existing tests retained plus three new tests; 45.63 seconds. |
| `npm run typecheck` | PASS: TypeScript `--noEmit`. |
| `npm run build` | PASS: TypeScript plus Vite 7.3.7, 34 modules; 6.86 seconds. |
| Row preservation and mode state | PASS: all 18 nodes, values, row markup and ordering retained through mouse/keyboard selection and Combined restoration; one active/pressed control. |
| Geometry and prior interactions | PASS: sampled panel/section/control rectangles, typography, readouts, fields, slider, checkbox, Buy/Sell and notice behavior retained. |
| Reference/theme integrity | PASS: authoritative raw HTML, archived snapshot, palette, remaining CSS, prior local-controls source, logo and assets match their unchanged hashes. |
| Browser errors/external HTTP | No page exceptions or external HTTP attempts during tests. |

Checks ran outside the established Windows sandbox restrictions for Edge/Vite. Final source review and `git diff --check` passed. No known failing requirement remains in this phase's three-control display scope; live-data behavior remains explicitly unimplemented.

## Limitations and exclusions

Only the captured nine rows per side are available. Single-side modes retain the original side slot rather than expanding the visible side or generating additional depth. Local display mode resets on reload. No precision/aggregation, settings, Market Trades content, row-click trading, financial calculation, account balance, real order or live service is added.

The original HTML/reference files, logo, palette, chart, Buy/Sell forms, slider, checkbox, order types and all other controls are unchanged. Physical assistive technology, mobile hardware and Firefox/Safari were not separately tested; accessibility evidence covers browser roles, names, focus and pressed/hidden states. No backend, API, trading WebSocket, extra page or Phase 02F work was started.
