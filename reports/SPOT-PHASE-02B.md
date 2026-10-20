# NEXORA Spot Trading — Phase 02B

Date: 2026-10-20. Baseline: `33f7dbd3f4d19c1067c31a944d2e7a826a3aeba8` on `main`, fetched and confirmed before changes. Read together with [Phase 02A](SPOT-FUNCTIONAL-AUDIT.md).

## Scope and evidence

This phase adds control contracts and regression tests only. Application TypeScript, archived HTML, CSS, chart assets, logo, geometry and existing visible behavior remain unchanged. No missing panel, trading rule, destination or service contract is invented. These contracts describe the existing prototype; passing characterization tests do not certify trading functionality or accessibility completeness.

Evidence: handler inspection in `src/main.tsx`, the Phase 02A findings, current browser interactions, computed styles, and SHA-256 preservation checks. `nexora-spot.html` remains the authoritative design reference. Its saved scripts do not retain the original runtime behaviors; missing menu/form contents cannot be inferred. The prior explicitly requested editable Market Price field is preserved even though the original captured field was disabled.

## Current control contracts

| Control / selector | Established local behavior | Incomplete behavior / boundary |
| --- | --- | --- |
| Price: `[data-testid="spot-trade-buyPrice"]` | Visible editable native number input, `step=any`. Decimal typing and replacement persist across notice updates, dismissal, side highlighting and unsupported tabs. | No pricing calculation, min/required/tick/affordability validation or real Market Price semantics. Native numeric syntax is not financial validation. |
| Total: `[data-testid="spot-trade-buyTotal"]` | Same numeric entry/persistence. Uncontrolled DOM value survives the memoized snapshot's unrelated React renders. | Explicit slider actions overwrite Total with `0` because captured available balance is zero. This is intentional current behavior, not a typing regression. No independent Sell field/data model. |
| Buy/Sell: `[class*="__dirBtnWrapper"] > [class*="__buyBtn"]` / `__sellBtn` | Click changes `index-module-scss-module__fsa5Rq__active` and sets `data-local-side=buy/sell` on the existing Buy wrapper. Sell colors the Deposit action with the approved danger token. Buy starts highlighted; the data attribute is populated on interaction. | Deposit remains Deposit; no real order or separate Sell form. Controls are divs without button keyboard semantics. Highlighting is only partial side functionality. |
| Percentage: `.ant-slider-v2`, `[role="slider"]` | Click maps position across the entire rail bounding box to rounded/clamped 0–100. Updates handle `left`, track width and `aria-valuenow`; writes Total `0`, preserves Price. Focused ArrowLeft/Right change by one; Home/End select 0/100; bounds clamp. | No continuous pointer-move handling. Marks use bubbling rail coordinates rather than an explicit mark-value model. Captured active mark/dot classes are not synchronized. No balance calculation. Release can synthesize a click; exact release outcome depends on hit target and browser, so the drag test asserts only the stable missing continuous update. |
| Hide Other Pairs: `input.ant-checkbox-v2-input` | Native checked state toggles by click and focused Space. | Wrapper classes/custom checkmark remain unchanged (opacity 0, zero-scale matrix). No code reads checked state to filter; captured order list is empty. This is partially working, not a working filter. |
| Tabs: `[role="tab"]` | Selected tab click is prevented and otherwise a no-op. Inactive tab click emits `Local mock prototype: <label> contents are not included in the saved HTML.` Selection and visible panel remain captured. Applies to all current tab groups. | No missing content is loaded and no tab state transition occurs. Focused Limit tab div does not activate with Enter. Nested anchor keyboard behavior can differ; complete ARIA tab keyboard support is absent. |
| Generic actions: delegated `button,a` | Prevent default navigation/submission and emit `Local mock prototype: <text or this action> has no connected service.` Deposit is a placeholder action. | Notice is not fulfillment of the named action. No original-venue URL is enabled by these tests. Other div/span/SVG controls may have no handler. |
| Timeframe/chart mode/pair name: `__favInterval`, `__chartType`, `__bigName` | Emit the static chart/BTC market notice. Search input Enter emits the one-saved-market notice. | No actual pair, chart renderer, timeframe, series or search result changes. |
| Local notice: `.prototype-notice[role="status"]` | One notice string; different messages replace it and restart a 5000 ms timer. Dismiss button clears it. Expiry/dismissal preserve entered values. | Repeating the identical string does not change React state, so the existing effect/timer is not restarted. No queue, action success, service connectivity or durable notification model. |

No guarantee of persistence across page reload or navigation is introduced. Side/percentage/checkbox state is local DOM state; numeric values are not stored in an account or persistent client store.

## Automated coverage

`tests/spot-controls.test.mjs` uses Node's built-in test runner plus pinned Playwright. Each browser test gets an isolated 1440×900 context at default browser scale; no screenshots or image comparisons are used. The runner starts/stops its own Vite server on an ephemeral loopback port, leaving preview port 5271 alone. HTTP routes outside this test server are blocked and fail the test; page exceptions also fail it. This is a local request guard, not a complete live-integration security audit. Vite's development HMR socket is not a trading feed.

| Test | Assertion / interpretation |
| --- | --- |
| Frozen application/reference content/assets | SHA-256 of every tracked `src/`, `public/` file and `index.html` matches the pre-change baseline. Covers archived DOM and approved CSS/logo without substituting element counts for geometry evidence. |
| Raw authoritative reference preservation | Original file SHA-256 equals `ad04c063ef0d58bd3d3a9708e9b2a36bb7a29fc2320a909239f5e113abca8a7c`. Explicit skip if absent in a fresh clone because this raw reference is intentionally untracked. The tracked archived DOM check always runs. |
| Decimal entry/persistence | Native number editability, sequential typing/replacement, both values surviving notices/side/unsupported tab actions, exactly two numeric fields. |
| Buy/Sell state | Both highlight transitions, wrapper side attribute, Sell action color, continued original Buy inputs and Deposit label. |
| Slider click/keyboard | Midpoint 50%, increments/decrements, Home/End, boundary clamping, handle/track/ARIA agreement, explicit Total reset and Price preservation. |
| Known slider gap | Pointer motion alone does not update percentage; captured mark/dot classes remain unchanged. Passing means the gap is documented and preserved, not fixed. |
| Existing checkbox | Click/Space toggle native state while custom visual state remains hidden and unchanged. Passing does not establish filtering. |
| Unsupported tabs | All currently visible inactive tabs produce their label's missing-content notice, remain unselected, and preserve selected tab IDs. Selected Market is a no-op. Limit Enter remains unsupported. |
| Notices | Different-message replacement, single notice, explicit dismissal and exact five-second expiry using a paused browser clock; input survives. |
| Palette and input backgrounds | All eight approved computed tokens, application backgrounds `rgb(8, 8, 8)`, both input fills `rgb(16, 16, 20)`, text `rgb(244, 246, 250)`, placeholders `rgb(146, 154, 170)`. |

The hash baseline is deliberately strict for this no-UI-change phase. It freezes current content, including known stale metadata; it does not assert that every preserved detail is correct or identical to the live original exchange. A future authorized source/asset change must review and explicitly update the affected hashes rather than silently regenerate the baseline. Raw byte hashes may detect line-ending-only changes too.

### Running the checks

Requires Node 22+ (verified here with Node 24), `npm ci`, and a Playwright-supported browser. Standard Chromium setup:

```sh
npx playwright install chromium
npm test
npm run typecheck
npm run build
```

To use installed Edge in PowerShell instead of downloading Chromium:

```powershell
$env:SPOT_BROWSER_CHANNEL = 'msedge'
npm test
```

No absolute developer-machine dependency paths are embedded in the suite. `tests/baseline.json` records the source revision and hashes; no original HTML copy, screenshots, secrets or test output artifacts are committed. Playwright is a development dependency only; build/dev architecture is unchanged.

## Selector risks for future phases

| Current selector/pattern | Risk / future recommendation (not implemented) |
| --- | --- |
| Substring CSS module classes (`__buyBtn`, `__sellBtn`, `__buyWrapper`, `__chartType`, `__bigName`) and literal generated active class | Build-generated hashes and substring collisions can silently alter target scope. Add intentional stable identifiers and a single scoped control-state model in a later approved phase. Tests centralize current selectors and strict locators reject duplicate matches. |
| `root.querySelector('[role="slider"]')`, `.ant-slider-v2-track` and non-null assertions | Only the first match is wired; missing track or changed archived markup can throw. Future selectors should be scoped to the confirmed order form and validated before use. |
| Root-wide `button,a`, `[role="tab"]` and handler precedence | Broad interception blocks all anchor navigation and treats unrelated actions alike. Nested SVG/caret/tab/anchor targets inherit parent behavior; text is used as action identity. Future explicit action contracts should replace this after target/content approval. |
| Buy/Sell recognition via trimmed English `textContent` | Translation, extra labels or nested text can bypass the side handler. Use stable action identity after approval. |
| Captured `rc-tabs-*` IDs and CSS-library internals | Useful exact baseline selectors, but capture/build changes can renumber them. Current tests are intentionally tied to this archived page, not reusable exchange components. |
| Mutable uncontrolled inputs and `data-testid` Buy names in Sell state | Stable test hooks are available but do not express a complete state contract. A future state refactor must retain typing/persistence tests and explicitly authorize any value changes. |
| Dynamic inventory of inactive tabs in tests | Verifies behavior for every captured visible inactive tab. The frozen snapshot hash separately detects accidental control removal; inventory alone would not detect that regression. |
| Original-venue anchors and stale TRX metadata on BTC display | Do not enable generic navigation or derive trading identity from these captured attributes. Confirm NEXORA URL policy and a selected-instrument contract first. |

## Known limitations and trading boundary

Known incomplete behavior remains unchanged: hidden checkbox checkmark/no filtering, no continuous slider drag/active marks, visual-only Sell, unsupported tabs, missing keyboard semantics, no financial validation and no real chart engine. Characterization tests intentionally pass when those known gaps remain; they are not pending success claims for future functionality.

Saved HTML cannot establish missing Limit/TP-SL/Sell states, menu options, trade-history schemas, price/total business rules, exact tick sizes, fees, rounding or funding workflows. Static BTC values, zero balance, fees, captured counts, chart pixels and Network Normal are not live data. No tests claim real balances, order placement, cancellation, funds transfer, authentication, market freshness or service health.

Future live work requires separately approved instrument/data schemas, URL policy, validation semantics, authentication/authorization and order/funding lifecycle contracts. No API, backend or trading WebSocket is added here. A UI highlight or local notice must never be used as an execution result.

## Verification results

Initial sandbox attempts could not launch Edge and Vite could not resolve source realpaths (`EPERM`); checks were rerun outside that Windows restriction. The first unrestricted run passed 9/10 tests; the notice boundary test allowed its fake clock to advance with wall time. The test harness was corrected to explicitly pause the clock; application behavior was not changed.

| Final check | Result |
| --- | --- |
| `SPOT_BROWSER_CHANNEL=msedge npm test` (PowerShell environment syntax shown above) | PASS: 10 tests, 0 failures, 0 skipped, 0 TODO; headless installed Edge, 1440×900, 18.35 seconds. |
| `npm run typecheck` | PASS: TypeScript `--noEmit`. |
| `npm run build` | PASS: TypeScript plus Vite 7.3.7, 32 modules; production assets generated only in ignored `dist/`. |
| Source/reference/asset integrity | PASS: all frozen tracked frontend files plus locally available original HTML match baseline hashes. |
| Runtime errors / external HTTP | No page exceptions or external HTTP attempts in the tested interactions. |

No automated requirement remains failing. The behavior gaps listed above are deliberately preserved and independently documented; this passing suite does not imply those features are implemented. Verification covers the current Edge browser only, not a multi-browser/device matrix, visual geometry comparison, production-host deployment or live trading.

## Recommended next subphase

**02C — bounded local state completion**, after approval: first confirm checkbox filtering/visual contract and slider pointer/mark behavior, then implement only those confirmed local states with mouse/keyboard regression tests. Separately confirm Sell form/units before changing it, and Market Price/Total rules before adding validation or coupling. Keep chart/data services, additional menus, missing panels and real execution out of that increment. Phase 02C is not started by this report.
