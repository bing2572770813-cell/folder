# Development Checks

Run from the repository root:

```powershell
npm --prefix work run check
```

The command runs tool tests, compiles the backend once, executes every backend test, builds the two HTML files, runs the existing frontend/compatibility suite, then checks working and staged diffs. It invokes the underlying programs directly rather than npm scripts that each rebuild the backend. Backend tests are discovered from the directory, including untracked test files.

Successful stages print only their name and elapsed time. Failures print the last 16 lines, the error or termination signal when present, and the full log path. The command exits nonzero and marks subsequent stages as skipped. Build and test commands still execute repository code and regenerate `outputs/index.html` and `outputs/game.html`.

Every run writes full stdout/stderr logs and `report.json` under the ignored `work/.dev-checks/<run-id>/` directory. `work/.dev-checks/latest.json` points to the most recent report. Reports include commands' exit codes, Node version, durations and skipped stages. Concurrent runs retain separate logs, but should not be used in the same worktree because they share generated build files.

Existing `test`, `backend:test` and `build` commands are unchanged. The new entry runs both test suites; a green `npm test` alone does not assert that backend tests passed. Use `npm --prefix work run check:tools` to test the check runner itself.

For faster feedback during implementation, use `npm --prefix work run check -- backend`, `-- frontend`, or `-- tools`. Backend scope compiles and runs every backend test. Frontend scope compiles the shared backend, builds HTML and runs the frontend suite. Tools scope runs all auxiliary tool tests. These are explicitly partial checks, not substitutes for the default full check before committing. Unknown scopes fail. No test-result caching is used.

Browser performance sampling and screenshots are separate checks; a successful report does not prove a frame-time target or visual correctness. Review generated HTML changes before committing. Logs may contain local paths and application error details; inspect them before sharing.

## Preview Preparation

Run `npm --prefix work run preview` to compile the backend, rebuild editor/game HTML, verify both pages and the prefab catalog over HTTP, and keep a preview server available. The command prints editor and game URLs after verification. The OS assigns an unused loopback port; it does not stop or reuse any existing server. Ctrl+C closes the preview. This is a freshly built snapshot, not a watcher: re-run after editing source. Build failures stop preparation and retain logs in `.dev-checks`.

For unattended environment checks, run `npm --prefix work run preview -- --smoke`. It performs the same build and HTTP checks, records their timings, then closes the temporary server. Requests time out after five seconds; missing pages, invalid page types and empty or erroneous catalogs fail. This checks HTTP readiness only, not browser execution, rendering or interaction correctness.

Do not run these commands concurrently in one checkout because HTML and compiled backend outputs are shared. Use separate worktrees for parallel development.

## Cost Experiments

Run `npm --prefix work run experiment:cost -- 3` to compare the existing frontend runner, isolated serial execution, two/four isolated test workers, and normal/incremental backend compilation. It builds first, records a separate warm-up for every variant, rotates sample order and reports median/min/max. Failed variants abort rather than being counted as savings. Full logs and `comparison.json` remain under `.dev-checks/experiment-*`.

The parallel variant discovers root `test-*.mjs`, `test-*.cjs` and `verify-*.cjs` files, excluding the runner itself. A tool test compares that set against the existing runner. Test processes have isolated globals; the currently inspected filesystem-writing tests use unique temporary directories. New tests must preserve isolation before being run in parallel. Every test still runs; results are not cached.

Use `npm --prefix work run frontend:fast -- 4` for optional faster frontend feedback after building. This is partial verification; default full checks remain unchanged. Try two workers if four increase contention on another machine.

Three measured warm samples on this checkout gave frontend medians of 3566ms (existing serial), 3561ms (isolated serial), 1934ms (two workers), and 1379ms (four workers). Four workers reduced the test stage by about 61%; this excludes HTML build time and is not a reduction in total development time. Normal compilation was 236ms versus 148ms incremental, saving only 88ms. Incremental compilation is therefore experimental and does not replace the default compiler.

Compiler experiments emit to independent directories and compare emitted JavaScript hashes. They measure unchanged-source rebuilds, not correctness after source edits or missing outputs. Machine load, source changes and dependency versions affect all timings; remeasure before relying on these numbers.

## Browser Smoke Checks

Run `npm --prefix work run browser:check` to build fresh HTML and launch a headless installed browser on a temporary loopback server. It uses Playwright Core and does not download browsers. Windows defaults to Edge, other platforms to Chrome. Set `FOLD_BROWSER_CHANNEL` to `chrome` or `msedge`, or `FOLD_BROWSER_EXECUTABLE` to an installed executable, if needed. Missing browsers fail with a retained log.

Each run uses fresh browser contexts, so it does not change your browser's maps or sessions. Scenarios cover desktop boot, renaming/undo, play/edit mode switching, restart at zero steps, reload restoration, mobile editor boot and mobile game boot. Runtime exceptions, console errors, failed requests and HTTP errors fail verification. Only the unrelated favicon request is fulfilled locally. Screenshot color sampling rejects nearly uniform canvas captures.

Reports, desktop/mobile screenshots, canvas screenshots and Playwright traces are saved in `.dev-checks/browser-*`; failures retain a screenshot/trace when possible and return nonzero. Close operations release the temporary browser and server. Open traces with separately available Playwright tooling. This command is separate from full unit checks because it requires an installed browser and graphics support.

The first measured run completed six scenarios in 6.59s, or 8.61s including build preparation. This is automated verification time, not a measured saving against manual work. Screenshot inspection showed the mobile game's map extending beyond the viewport and top controls overlapping the HUD. The smoke check proves boot and selected behavior; these existing visual issues remain to be addressed in product development. Pixel variation alone cannot verify framing, readability, terrain editing, movement, teleport or lift mechanics.
