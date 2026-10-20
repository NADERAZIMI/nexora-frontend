# NEXORA TradingChest pre-integration audit — 2026-10-20

## Scope
Static read-only inspection of upstream GitHub `evotrader/TradingChest`, commit
`d3c8c6a5510ffaaf0c74a8d4902b28d9e646ccb8` (source tree: 647 tracked paths, 363 source blobs).
**This is not a complete per-line code audit, runtime sandbox evaluation, malware clearance,
or installed npm tarball comparison. No upstream code was executed or installed on NEXORA.**

## Observations
- Upstream declares Apache-2.0, `trading-chest@0.10.0`, `klinecharts@10.1.0` peer,
  and `solid-js` runtime dependency. React >=18 is optional peer.
- Root `package.json` shows no preinstall/install/postinstall lifecycle script. Builds
  invoke TypeScript, Vite, declaration bundling and the local
  `scripts/link-entry-types.mjs`, which edits only generated `dist/*.d.ts`.
- Lockfile v3 declares npm registry resolved URLs and integrity strings; individual
  dependency tarball contents and provenance have **not** been independently verified.
- Tracked Git tree shows no `.exe/.dll/.so/.node/.wasm` binary files.
- `src/DefaultDatafeed.ts` is a Polygon.io demo, including an API key supplied to its
  constructor and network requests; it is **not suitable for NEXORA** and must not be
  instantiated. `src/datafeed/ReconnectingWebSocket.ts` accepts a URL supplied by the
  caller. Both require a strict MEXC-only adapter.
- GitHub Actions release workflow uses npm publish with `NPM_TOKEN`. This executes in
  the publisher's CI, **not** a normal frontend runtime; NEXORA must not reuse it.
- No obviously hostile code was seen in the above inspected entrypoints/scripts.
  **This does not prove absence of malicious functionality.**

## Pending checks — BLOCKERS before integration
1. Obtain exact npm `trading-chest@0.10.0` tarball and compare its bundled JS
   against a clean build of the pinned upstream commit.
2. Scan **all** runtime source files and transitive dependencies for exfiltration,
   `eval`, dynamic code construction, hidden network destinations, filesystem/process
   execution, and browser persistence. Review any flagged uses manually.
3. Run vulnerability checks against a freshly generated, locked dependency graph,
   including a real `npm audit --omit=dev` and package integrity verification.
4. Build in an isolated ephemeral environment with no credentials, SSH agent,
   GitHub write token, production network or deployment secrets.
5. Browser-run the packaged artifact against a mocked/local MEXC-only datafeed;
   inspect actual requests, CSP violations, worker and storage behavior.
6. Verify compatibility with React 19.2 and independent `NEXORA` Spot styling.
7. Only after security gates pass, implement a separate `/chart-candidate` page
   with read-only MEXC data and leave the existing Spot chart intact.

## Recommendation
**Status: CONDITIONAL / NOT APPROVED FOR PRODUCTION OR VPS INSTALLATION.**
TradingChest is the preferred functional candidate but remains untrusted
third-party code until the pending checks complete. Pin versions and hashes;
do not use mutable `main`, run unknown install hooks, load unpinned CDN scripts,
or use its Polygon demo datafeed.
