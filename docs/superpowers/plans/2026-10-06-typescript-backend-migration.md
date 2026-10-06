# TypeScript Backend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Fastify + TypeScript backend service while preserving the current static server, prefab API, CLI behavior, build output, and browser gameplay boundaries.

**Architecture:** Keep browser code and gameplay in the existing `work/` modules. Add a typed backend adapter under `work/backend/`; the adapter owns HTTP lifecycle and routes, while resource catalog code remains the single source of prefab/tag filesystem behavior. Keep CommonJS compatibility entry points until all callers and checks use the new implementation.

**Tech Stack:** Node.js, TypeScript, Fastify, native `node:fs`/`node:path`, existing `.mjs` normalization modules, Node test runner style used by the repository.

**Spec:** `docs/superpowers/specs/2026-10-06-typescript-backend-migration-design.md`

## Global Constraints

- Do not move or split player state machines; all player interaction remains in `work/player.cjs`.
- Do not change map gameplay rules, map JSON format, prefab JSON format, or browser UI behavior.
- Keep `/api/prefabs` response shape and `Cache-Control: no-store` behavior compatible.
- Reject path traversal and keep static files rooted at `outputs/`.
- Preserve hot catalog reads, isolated bad-file errors, duplicate-ID rejection, and no-overwrite writes.
- Keep legacy CommonJS entry points working until migration verification is complete.
- Do not include existing unrelated untracked files in commits: `docs/` files outside this plan, `outputs/special-tile-requirements.md`, and `work/theme.mjs`.
- Each coherent migration unit gets its own commit and relevant checks.

---

### Task 1: Add TypeScript backend toolchain and typed configuration

**Files:**
- Create: `work/backend/package.json`
- Create: `work/backend/tsconfig.json`
- Create: `work/backend/src/config.ts`
- Create: `work/backend/test/config.test.mjs`
- Modify: `work/package.json`
- Modify: `work/package-lock.json`

**Interfaces:**
- Produces `BackendConfig`, `loadBackendConfig(env, paths)` and the backend package scripts used by later tasks.

- [ ] **Step 1: Write the failing configuration test**

Create a test that imports the compiled configuration module and asserts the default port is `4173`, `FOLD_PORT=4175` produces `4175`, and output/resource paths are resolved absolute paths.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test work/backend/test/config.test.mjs`

Expected: FAIL because the TypeScript backend module and build output do not exist.

- [ ] **Step 3: Add the minimal TypeScript toolchain and configuration implementation**

Add TypeScript and Fastify as work dependencies, configure strict ESM-compatible compilation for Node, and implement:

```ts
export type BackendConfig = {
  port: number;
  outputRoot: string;
  prefabRoot: string;
};

export function loadBackendConfig(
  env: NodeJS.ProcessEnv = process.env,
  roots = { workRoot: new URL('../../', import.meta.url) },
): BackendConfig;
```

Reject non-integer ports outside `1..65535` with an explicit error.

- [ ] **Step 4: Run the focused test and the existing suite**

Run: `node --test work/backend/test/config.test.mjs` and `npm --prefix work test`

Expected: PASS; existing behavior remains unchanged.

- [ ] **Step 5: Commit**

```bash
git add work/package.json work/package-lock.json work/backend
git commit -m "build: add TypeScript backend toolchain"
```

### Task 2: Extract a typed catalog adapter without changing catalog behavior

**Files:**
- Create: `work/backend/src/resources/catalog.ts`
- Create: `work/backend/test/catalog.test.mjs`
- Modify: `work/resources/prefab-catalog.cjs`
- Modify: `work/prefab-catalog.cjs`
- Modify: `work/write-prefab.cjs`
- Modify: `work/write-tag-prefab.cjs`

**Interfaces:**
- Consumes existing `normalizePrefab` and `normalizeTagPrefab` modules.
- Produces `readCatalog(root): Promise<CatalogResult>`, `savePrefab(root, data)`, and `saveTagPrefab(root, data)` with the current result/error semantics.

- [ ] **Step 1: Capture current catalog behavior in focused tests**

Cover entity and tag subdirectories, legacy root entity fallback, malformed-file isolation, cross-directory duplicate IDs, 128 KB limits, no-overwrite behavior, and successful writes to the correct directory.

- [ ] **Step 2: Run the focused tests before migration**

Run: `node --test work/backend/test/catalog.test.mjs` and `node work/test-prefab-catalog.cjs`.

Expected: the new focused test fails because the typed adapter is absent; the existing catalog regression test passes.

- [ ] **Step 3: Implement the typed adapter as the single filesystem implementation**

Move the catalog logic into `catalog.ts` while preserving:

```ts
export type CatalogError = { file: string; message: string };
export type CatalogResult = {
  prefabs: unknown[];
  tags: unknown[];
  errors: CatalogError[];
};
export async function readCatalog(root: string): Promise<CatalogResult>;
export async function savePrefab(root: string, data: unknown): Promise<unknown>;
export async function saveTagPrefab(root: string, data: unknown): Promise<unknown>;
```

Do not duplicate normalization rules. The CommonJS module becomes a compatibility wrapper that dynamically imports the compiled adapter or delegates to the TypeScript build output used by the package scripts.

- [ ] **Step 4: Run all catalog and CLI tests**

Run: `node --test work/backend/test/catalog.test.mjs`, `node work/test-prefab-catalog.cjs`, `node work/test-tag-prefab.mjs`, and the two write CLI tests.

Expected: PASS with unchanged JSON results and no file overwrite.

- [ ] **Step 5: Commit**

```bash
git add work/backend work/resources/prefab-catalog.cjs work/prefab-catalog.cjs work/write-prefab.cjs work/write-tag-prefab.cjs
git commit -m "refactor: add typed prefab catalog adapter"
```

### Task 3: Implement the Fastify app factory and API contract

**Files:**
- Create: `work/backend/src/app.ts`
- Create: `work/backend/src/routes/prefabs.ts`
- Create: `work/backend/test/api.test.mjs`

**Interfaces:**
- Consumes `BackendConfig` and typed catalog adapter.
- Produces `createApp(config, dependencies?)`, returning a Fastify instance suitable for `app.inject()` tests and real startup.

- [ ] **Step 1: Write API contract tests**

Test `GET /api/prefabs`, `POST /api/prefabs`, catalog read errors, JSON content type, and `Cache-Control: no-store`. Stub the catalog dependency so route behavior is tested without mutating repository assets.

- [ ] **Step 2: Run the tests and verify the route is absent**

Run: `node --test work/backend/test/api.test.mjs`

Expected: FAIL because `createApp` is not implemented.

- [ ] **Step 3: Implement the Fastify app and prefab route**

Register a route that calls the injected `readCatalog` dependency on every request. Return the catalog object for GET, status `405` and `{error:'方法无效'}` for other methods, and status `400` with `{error}` for catalog exceptions. Set JSON content type and `Cache-Control: no-store`.

- [ ] **Step 4: Run focused and existing tests**

Run: `node --test work/backend/test/api.test.mjs` and `npm --prefix work test`.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add work/backend/src/app.ts work/backend/src/routes/prefabs.ts work/backend/test/api.test.mjs
git commit -m "feat: add typed Fastify prefab API"
```

### Task 4: Add secure static file routing

**Files:**
- Create: `work/backend/src/routes/static-files.ts`
- Create: `work/backend/test/static-files.test.mjs`
- Modify: `work/backend/src/app.ts`

**Interfaces:**
- Consumes `BackendConfig.outputRoot`.
- Produces static route behavior for `/`, `/index.html`, existing assets, missing files, encoded traversal attempts, and directories.

- [ ] **Step 1: Write traversal and static serving tests**

Use a temporary output root containing `index.html` and one asset. Assert `/` serves the index, existing files are returned, missing files return `404`, and encoded paths such as `/%2e%2e/%2e%2e/secret` never escape the configured root.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --test work/backend/test/static-files.test.mjs`

Expected: FAIL because static routing is absent.

- [ ] **Step 3: Implement root-confined static handling**

Decode the URL pathname once, map `/` to `index.html`, resolve against `outputRoot`, and verify the resolved path remains inside the root before reading. Return `404` for missing files and directories. Set HTML content type for `.html` and retain binary handling for other files.

- [ ] **Step 4: Run focused, build, and full tests**

Run: `node --test work/backend/test/static-files.test.mjs`, `npm --prefix work run build`, and `npm --prefix work test`.

- [ ] **Step 5: Commit**

```bash
git add work/backend/src/app.ts work/backend/src/routes/static-files.ts work/backend/test/static-files.test.mjs
git commit -m "feat: serve output files from Fastify"
```

### Task 5: Add the TypeScript server entry and preserve the old command

**Files:**
- Create: `work/backend/src/server.ts`
- Create: `work/backend/test/server.test.mjs`
- Modify: `work/package.json`
- Modify: `work/server.cjs`

**Interfaces:**
- Consumes `createApp` and `loadBackendConfig`.
- Produces `startServer()` and the existing `npm --prefix work start` behavior on `127.0.0.1:${FOLD_PORT || 4173}`.

- [ ] **Step 1: Write startup lifecycle tests**

Start the app on an ephemeral port, request `/api/prefabs` and `/`, then close the Fastify instance and assert the port can be released. Test invalid port configuration produces a clear error.

- [ ] **Step 2: Run focused tests and verify absence**

Run: `node --test work/backend/test/server.test.mjs`

Expected: FAIL because the typed server entry is absent.

- [ ] **Step 3: Implement startup and compatibility wrapper**

Compile TypeScript to a local backend output directory, make `server.ts` listen on `127.0.0.1`, and change `work/server.cjs` into a small launcher that starts the compiled TypeScript server. Keep the command and port behavior unchanged.

- [ ] **Step 4: Run lifecycle, build, and full tests**

Run: `node --test work/backend/test/server.test.mjs`, `npm --prefix work run build`, and `npm --prefix work test`.

- [ ] **Step 5: Commit**

```bash
git add work/backend/src/server.ts work/backend/test/server.test.mjs work/package.json work/server.cjs
git commit -m "refactor: run local server through TypeScript"
```

### Task 6: Route build and CLI callers through the typed adapter

**Files:**
- Modify: `work/build.cjs`
- Modify: `work/write-prefab.cjs`
- Modify: `work/write-tag-prefab.cjs`
- Modify: `work/package.json`
- Create: `work/backend/test/compatibility.test.mjs`

**Interfaces:**
- Consumes the compiled catalog adapter through one documented compatibility entry.
- Produces unchanged build output, CLI behavior, and legacy CommonJS import behavior.

- [ ] **Step 1: Add compatibility tests**

Assert the build reads the same catalog as the API, the generated HTML contains injected prefab/tag catalogs, the generated game HTML contains the demo map, and legacy `require('./prefab-catalog.cjs')` exports still work.

- [ ] **Step 2: Run compatibility tests before switching callers**

Run: `node --test work/backend/test/compatibility.test.mjs`

Expected: FAIL for the new typed-caller assertions.

- [ ] **Step 3: Switch callers to the typed adapter**

Make `build.cjs` and both write CLIs use the compiled adapter or a single CJS bridge. Do not make build call the HTTP server. Preserve output filenames and injected globals.

- [ ] **Step 4: Run the complete verification set**

Run:

```powershell
npm --prefix work run build
npm --prefix work test
node --test work/backend/test/*.test.mjs
```

Then start the server and verify `/`, `/api/prefabs`, `outputs/index.html`, and `outputs/game.html` manually or with the existing browser verification flow.

- [ ] **Step 5: Commit**

```bash
git add work/build.cjs work/write-prefab.cjs work/write-tag-prefab.cjs work/package.json work/backend/test/compatibility.test.mjs
git commit -m "refactor: route build and CLI through typed backend"
```

### Task 7: Final cleanup and migration documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-10-06-typescript-backend-migration-design.md`
- Modify: `work/README.md`
- Modify: `work/resources/README.md`
- Create: `work/backend/README.md`

**Interfaces:**
- Documents the final commands, backend ownership, compatibility wrappers, and test entry points.

- [ ] **Step 1: Document the final structure and commands**

Document `npm --prefix work run build`, `npm --prefix work start`, backend compilation, test commands, port configuration, and the rule that browser player logic remains in `work/player.cjs`.

- [ ] **Step 2: Run final checks**

Run `git diff --check`, the full test suite, the build, the backend tests, and `git status --short` to verify unrelated worktree files remain untouched.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-10-06-typescript-backend-migration-design.md work/README.md work/resources/README.md work/backend/README.md
git commit -m "docs: document TypeScript backend migration"
```
