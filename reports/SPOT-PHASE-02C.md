# NEXORA Spot Trading — Phase 02C

Date: 2026-10-20. Starting revision: `1acc95bdb3a45053d9117e6282b81f833ef268ad`, fetched and confirmed equal to `origin/main` before changes. Reviewed [Phase 02A](SPOT-FUNCTIONAL-AUDIT.md), [Phase 02B](SPOT-PHASE-02B.md) and the existing regression suite.

## Implemented scope

Only the existing percentage slider and Hide Other Pairs checkbox are completed locally. No dependencies were added. The archived snapshot and authoritative `nexora-spot.html`, approved palette, logo, chart assets, layout CSS, typography, Buy/Sell handling, order types, notices and unrelated actions are unchanged.

The small `attachSpotLocalControls` helper owns these two controls and returns listener/pointer-capture cleanup for the existing React effect. Slider queries are scoped to the existing Buy form; track/handle access is guarded instead of relying on non-null assertions. No page or application architecture was replaced.

## Slider contract

- Primary pointer press starts interaction and focuses the existing slider handle without scrolling. Pointer capture keeps dragging active outside the rail. Mouse and touch move events update continuously before release.
- Values are rounded and clamped to integer percentages 0–100. Handle `left`, track width, `aria-valuenow`, active percentage labels and active dots share the same percentage. Existing 0–100 ARIA bounds remain unchanged.
- Marks/dots at or below the percentage use their existing active CSS classes. Rail clicks retain coordinate-based selection. ArrowLeft/Right change by one; Home/End select 0/100, with boundary clamping.
- Touch scrolling is suppressed only on the slider while its listeners are attached. Pointer release commits its last coordinate and releases capture. Cancellation retains the last valid percentage and releases capture without applying cancellation coordinates; lost capture ends dragging. Unrelated pointer IDs cannot move or finish an active drag. Secondary-button/non-primary presses do not start one.
- Subsequent pointer movement after release/cancellation does not change the value. A new pointer interaction can start normally. Cleanup removes listeners and releases any active capture.
- Every explicit percentage action writes Total `0`, preserving the captured zero available balance. Price is never changed. Initial visual synchronization does not write either input. No amount calculation, funds, pricing rule or account data is introduced.

## Checkbox and local filtering contract

The original native input and label retain default mouse/keyboard behavior. Its `change` event synchronizes `ant-checkbox-v2-checked` and `ant-checkbox-v2-wrapper-checked` with `input.checked`. Scoped checked-only CSS reveals the existing checkmark and uses the approved primary/text tokens; checkbox dimensions, borders' widths, positioning, spacing and typography are retained. The unchecked appearance is unchanged.

The checkbox's containing orders `section` exposes `data-local-hide-other-pairs`:

| Value | Local scope/meaning |
| --- | --- |
| `false` | All pairs would be eligible within this orders section. Default, derived from native unchecked state. |
| `true` | Only the selected pair would be eligible within this orders section. Derived from native checked state. |

This is a local state contract for a future approved row renderer. No order rows currently exist, so no rows are fabricated, hidden or fetched. The empty Deposit callout remains byte-identical during toggling. No filter is applied to the book, chart, market trades, wallets or other panels. State survives unrelated notice renders and resets with page reload; no account or persistent storage is involved. Native checked state is authoritative; direct programmatic changes must dispatch `change` to synchronize the custom visuals/state.

## Changed files and baseline review

| File | Purpose |
| --- | --- |
| `src/spot-local-controls.ts` | Scoped slider pointer/keyboard/visual synchronization and checkbox change/state handling, with cleanup. |
| `src/main.tsx` | Attach/dispose that helper; remove only the superseded slider click/keyboard implementation. All unrelated handlers remain intact. |
| `src/prototype.css` | Two scoped checked-checkbox rules using existing palette variables. No geometry or global theme rules added. |
| `tests/spot-controls.test.mjs` | Replace obsolete defect expectations and extend mouse/touch/cancellation/checkbox/state/geometry regression coverage. Other Phase 02B protections retained. |
| `tests/baseline.json` | Reviewed hash updates only for `src/main.tsx` and `src/prototype.css`, plus a new hash for the helper and starting-commit metadata. |
| `reports/SPOT-PHASE-02C.md` | This delivery/verification report. |

All other frozen baseline hashes, including snapshot, original reference hash, remaining CSS, index and assets, are unchanged. The baseline's original revision metadata is retained; `phase02cReviewedFrom` records this increment's starting revision. Updating these three entries intentionally authorizes the reviewed source changes, not unrelated reference or visual changes.

## Regression coverage and verification

The suite keeps decimal entry/persistence, Buy/Sell highlighting, unsupported tabs, notice replacement/dismissal/expiry, exact NEXORA tokens and input colors, source/asset preservation and optional raw-reference integrity checks.

New acceptance coverage replaces the two Phase 02B tests that expected missing drag/checkmark behavior:

- Continuous mouse motion through 0/25/50/75/100 before release, capture outside the rail, clamping beyond both ends, post-release inactivity, and subsequent click.
- Handle/track/ARIA and every mark/dot's active class checked together on percentage actions; keyboard controls and bounds remain covered.
- Pointer cancellation and explicitly lost capture, retaining the last percentage, stopping updates and allowing another interaction.
- Browser touch events through Chromium DevTools: continuous movement, touch cancellation, subsequent touch release and Price preservation.
- Native checkbox click, label click and Space; computed checkmark visibility, checked classes, section-local boolean state, persistence through notices, and unchanged empty order content.
- Before/after DOM geometry and font/padding checks for surrounding panels, inputs, orders section and rail. These checks use actual DOM rectangles, not screenshots or image-derived measurements.

The test server uses an ephemeral loopback port, and browser contexts remain isolated. Page exceptions and external HTTP attempts fail tests. The user's preview at port 5271 is not replaced. Generated build output stays ignored.

| Final verification | Result |
| --- | --- |
| `npm test` with `SPOT_BROWSER_CHANNEL=msedge` | PASS: 13 tests, 0 failures, 0 skipped, 0 TODO; headless installed Edge, 1440×900. |
| `npm run typecheck` | PASS: TypeScript `--noEmit`. |
| `npm run build` | PASS: TypeScript plus Vite 7.3.7; 33 modules, completed in 2.25 seconds. |
| Reference/assets/theme protection | PASS: original HTML, snapshot, palette, remaining CSS, logo and chart assets retain their frozen hashes. Only the reviewed source entries changed. |
| Geometry/empty state | PASS: sampled surrounding rectangles, fonts/padding and empty order content preserved during control interaction. No screenshot-based measurements. |
| Browser errors/external HTTP | No page exceptions or external HTTP attempts during the tests. |

An initial full run also passed all 13 tests. Final source review tightened the lost-capture handler to ignore unrelated pointer IDs, added that regression scenario and reran all checks successfully. Browser/build checks ran outside the Windows sandbox as required by the previously established Edge/Vite restrictions. No known failing requirement remains within this phase's two-control scope.

## Remaining limitations

Only local slider and checkbox state is provided. There are no real order rows or backend-dependent filter results to verify. Touch coverage uses headless Edge's browser touch protocol, not a physical phone; Safari/Firefox and physical-device gestures are not verified. Mark clicks still use the existing rail coordinate mapping rather than a new semantic mark-button API. Checkbox state has no account persistence.

The Phase 02A/02B gaps outside these two controls remain: visual-only Sell, missing inactive-tab content and keyboard semantics, static chart/book/market data, stale captured metadata/links, no trading validation or live account/funding/execution. None was implemented or represented as working. No APIs, trading WebSockets, account integration, new fields, populated histories or extra pages were added.

Phase 02C stops here; any further functional work requires the next instruction.
