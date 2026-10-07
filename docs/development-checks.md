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
