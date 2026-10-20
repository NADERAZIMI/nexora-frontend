# NEXORA Spot Trading — Phase 02D

Date: 2026-10-20. Starting revision: `99410fea21c1e77edd0540b7c3acf35b379b5ae0`. Local `HEAD` and fetched `origin/main` matched this requested starting commit. Reviewed the [Phase 02A audit](SPOT-FUNCTIONAL-AUDIT.md), [Phase 02B contracts](SPOT-PHASE-02B.md), [Phase 02C implementation](SPOT-PHASE-02C.md) and existing regression tests.

## Implemented local contract

Buy and Sell remain the same two captured divs, using the existing active class, colors and dimensions. Neither the archived snapshot nor authoritative HTML was edited. No CSS, palette, logo, chart, form structure, order type, dependency or configuration changed.

- The two controls are discoverable as toggle buttons within an accessible `Order side` group. Both have `tabindex=0`, accessible names from their existing labels, and explicit `aria-pressed=true/false`.
- Initialization selects Buy, matching the captured appearance, and initializes the existing form's `data-local-side=buy`. If the helper is reattached to an existing local Sell state, it retains that state.
- Mouse click, focused Enter and focused Space select a side. Keyboard activation occurs on keydown; default Space scrolling is prevented and repeated keydown events are ignored. Tab/Shift+Tab use normal document focus order. Selecting an already active side keeps it selected.
- A single selection function updates `data-local-side`, the existing highlight class and both pressed states together. Exactly one side remains selected; this is not an on/off action.
- Runtime hooks `data-local-order-side=buy/sell` identify the two controls. Event listeners are bound directly to those scoped elements and do not infer behavior from English label text or search every buy/sell-like class in the page. Initialization still uses the archived form/group classes to discover the fixed two-control structure; adapting a future archive would require reviewing that bootstrap boundary.
- Listener cleanup is integrated with the existing local-controls cleanup. Disposal removes both click and keydown handlers; reattachment works. No global key handlers or new root event delegation are introduced.

Selection does not replace a form or input node, change Price/Total, reset the percentage, or reset Hide Other Pairs. The original Deposit action and its existing Sell-state danger color remain; Deposit continues to show the local unsupported-service notice. The existing zero available balance remains static. Slider interaction still writes Total `0` and leaves Price untouched, as explicitly established in Phase 02C.

## Changed files and source review

| File | Change |
| --- | --- |
| `src/spot-local-controls.ts` | Add scoped side-selection initialization, accessible state, click/keyboard handlers and cleanup. Existing slider/checkbox logic is unchanged. |
| `src/main.tsx` | Remove only the superseded broad, text-dependent Buy/Sell click block. Existing local-controls attach/dispose and unrelated handlers remain. |
| `tests/spot-controls.test.mjs` | Keep all 13 existing tests/assertions and append three focused Buy/Sell regressions. Synchronize the shared percentage assertion with asynchronous browser touch delivery. |
| `tests/baseline.json` | Update only the reviewed `src/main.tsx` and `src/spot-local-controls.ts` SHA-256 values; add `phase02dReviewedFrom` metadata. All remaining hashes and prior revision metadata are retained. |
| `reports/SPOT-PHASE-02D.md` | This report. |

The authoritative raw HTML hash, archived DOM, all CSS, assets, logo and index remain frozen by the existing tests. No snapshot content or byte baseline unrelated to the two reviewed source files was relaxed.

## Verification coverage

Three new headless Playwright tests cover:

1. Initial accessible/visual Buy selection; mouse, Enter and Space selection for both sides, including repeat selection; exactly one active/pressed control; stable hook values; matching `data-local-side`; decimal Price/Total persistence and original input-node identity; no action notices from side selection; Tab/Shift+Tab focus and Space without page scrolling.
2. Unchanged control/panel/input/rail rectangles, typography, padding, border widths/radii and restored Buy colors; added accessibility attributes do not change control rectangles; slider/checkbox state survives switching; Deposit remains a notice; manually entered values survive Deposit/selection; later slider/checkbox actions retain Phase 02C behavior and only two numeric fields remain.
3. Scoped element identity despite changed label text, nested click handling, ignored unrelated lookalike elements, listener disposal and rebinding using a detached clone of existing DOM. The clone is never rendered and does not change the user's form state.

All 13 earlier tests and their assertions are retained: source/reference/assets, numeric entry, existing Buy/Sell highlighting, slider mouse/touch/cancellation/keyboard state, checkbox visuals/local state/empty orders, surrounding geometry, unsupported tabs, notices and approved computed colors. The shared percentage helper now waits for the expected ARIA value before performing its existing assertions because native touch input can arrive after the CDP command returns. Browser contexts use 1440×900 at default scale and an isolated ephemeral Vite server; no screenshots or image-based measurements are used. Page exceptions and external HTTP attempts fail tests. The existing preview port is left alone.

Verification encountered two issues during development: an existing touch test initially read its previous value before browser delivery (15/16 passed), resolved by waiting for expected ARIA state without removing assertions; TypeScript then identified the new helper parameter as incorrectly allowing `undefined` instead of the query's `null`, resolved by correcting that annotation. No slider/checkbox implementation changes were made to address the test timing.

| Final verification | Result |
| --- | --- |
| `npm test` with `SPOT_BROWSER_CHANNEL=msedge` | PASS: 16 tests, 0 failures, 0 skipped, 0 TODO; includes all 13 earlier and three new tests. Final run: 29.28 seconds. |
| `npm run typecheck` | PASS: TypeScript `--noEmit`. |
| `npm run build` | PASS: TypeScript plus Vite 7.3.7; 33 modules; 4.93 seconds. Generated output remains ignored. |
| Source/reference/asset protection | PASS: frozen hashes check the reviewed source files and all unchanged HTML/CSS/assets; raw authoritative HTML is present locally and checked. |
| Runtime and preservation checks | PASS: no page exceptions or external HTTP attempts; sampled layout/appearance, entered values, empty orders and prior slider/checkbox contracts preserved. |
| Scope | Five changed files only; no CSS, snapshot, reference HTML, assets, dependency or configuration modifications. |

Checks ran outside the established Windows sandbox restrictions for Edge/Vite. Browser coverage is headless installed Edge at default scale; this is functional/DOM verification rather than a screenshot fidelity claim.

## Remaining boundaries

This completes local selection only. Sell uses the same existing fields and test IDs; there is no independent Sell form, invented available balance, new calculation, account state, validation, order submission or execution. State is local to the page and resets on reload. The saved HTML cannot establish missing Sell/order-type panels or financial rules, and this phase does not infer them.

The accessibility claim covers the two buttons' names, roles, pressed state, focusability and requested keys in the tested browser. Physical assistive technology, Firefox/Safari and mobile-device selection were not separately tested. Existing unsupported tabs, static chart/book data and all other audit limitations remain outside scope. No backend, API, trading WebSocket, new page or additional functional phase was started.
