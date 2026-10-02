# Puzzle Catalog and Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a locally persistent puzzle catalog that keeps the four built-in puzzles, imports deduplicated Lichess puzzle batches, and supports UCI solutions.

**Architecture:** A small IndexedDB repository owns persistent records. A puzzle-catalog service composes built-in puzzles with imported records and exposes batch/recommendation operations to the app. A Node importer streams the upstream CSV into versioned static JSON shards; browser code only downloads those small shards on explicit request.

**Tech Stack:** Node.js 22.12+, JavaScript ESM, Vite, IndexedDB, `csv-parse`, `chess.js` 0.10.3 for importer position validation, `fake-indexeddb`, and the existing `node:test` suite through `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-29-game-review-puzzle-training-design.md`

## Global Constraints

- Keep the app client-side with no account system or application server.
- Preserve the four built-in puzzles and make their solutions use canonical UCI, like imported puzzles.
- Do not fetch, parse, or index the full Lichess puzzle dump in the browser.
- Import only standard-chess puzzles and retain source ID, source URL, rating, popularity, themes, and catalog version.
- Apply the Lichess setup move exactly once before storing an imported puzzle's playable FEN and solution.
- Keep storage behind an injected repository; UI code must not access IndexedDB directly.
- Do not create commits unless explicitly requested. Run `npm test`, `npm run typecheck`, and `npm run build` after the relevant changes.

## Review Focus

- Quoted CSV fields containing commas or escaped quotes must parse as one row; pin with `parses quoted puzzle CSV fields` in Task 2.
- Setup moves involving castling, promotion, or an invalid UCI move must either normalize legally or be rejected; pin with `normalizes setup moves and rejects invalid lines` in Task 2.
- Re-importing a source ID must update/skip the existing record without resetting attempts; pin with `deduplicates imported puzzles without clearing attempts` in Task 3.
- A network failure must leave built-in and already imported puzzles available; pin with `retains the local catalog when batch fetch fails` in Task 3.
- IndexedDB open, transaction, or quota failures must reject with a surfaced error and not claim a successful save; pin with `propagates failed IndexedDB writes` in Task 1.

---

## File Structure

- `src/storage/local-database.js`: IndexedDB schema and repository operations for puzzle catalog, attempts, catalog batches, games, and reviews.
- `src/services/puzzle-catalog.js`: built-in/imported catalog composition, batch loading, deduplication, and recommendations.
- `src/services/puzzle-runner.js`: UCI parsing, legal-move normalization, and solution move application independent of the DOM.
- `src/data/puzzles.js`: four built-in puzzles migrated to stable IDs and UCI solution moves.
- `scripts/import-lichess-puzzles.js`: streaming CSV filter and Lichess-to-app record normalization.
- `public/puzzles/lichess/manifest.json` and versioned JSON shards: compact data available to the static app host.
- `src/app/game-controller.js` and `index.html`: wire puzzle loading and selection to the existing puzzle tab.
- `style.css`: compact status and load-more presentation for the puzzle tab.
- `tests/local-database.test.js`, `tests/puzzle-catalog.test.js`, `tests/puzzle-import.test.js`: storage, catalog, and importer coverage.
- `tests/puzzle-runner.test.js` and `tests/puzzles.test.js`: canonical UCI playback and built-in puzzle schema.
- `tests/fixtures/lichess-puzzles.csv`: small synthetic CSV fixture; never include the upstream dump.
- `package.json` and `package-lock.json`: parser and test-only IndexedDB dependencies.

## Task 1: Local Database Repository

**Files:**
- Create: `src/storage/local-database.js`
- Create: `tests/local-database.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `openLocalDatabase({ indexedDB = globalThis.indexedDB, databaseName = 'chess-studies' } = {}) -> Promise<LocalDatabase>`.
- `LocalDatabase` exposes `puzzles.get(id)`, `puzzles.list(filter)`, `puzzles.upsertMany(items)`, `attempts.add(attempt)`, `attempts.listByPuzzleId(id)`, `batches.get(id)`, `batches.put(batch)`, `games.put(game)`, `games.get(id)`, `games.listRecent(limit)`, `reviews.put(review)`, and `reviews.get(gameId)`.
- `LocalDatabase.clearUserData()` clears imported puzzles, attempts, batches, games, and reviews, but does not affect bundled puzzle definitions.
- Built-in puzzle records remain bundled and are not deleted by clearing imported/user records.

- [ ] **Step 1: Add storage behavior tests**

Install `fake-indexeddb` as a development dependency. In `tests/local-database.test.js`, test that `openLocalDatabase()` creates the `puzzles`, `attempts`, `batches`, `games`, and `reviews` object stores; that records survive reopening the same database; that puzzle upserts use stable IDs; and that failed writes reject.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/local-database.test.js`
Expected: FAIL because the repository module and operations do not exist.

- [ ] **Step 3: Implement the repository**

Create schema version 1 with key paths `id` for puzzles/attempts/batches/games and `gameId` for reviews. Add indexes for puzzle rating and multi-entry themes, and for game completion time. Keep all transactions within repository methods and reject on abort/error. Add `clearUserData()` to clear imported puzzles, attempts, batches, games, and reviews without touching bundled data.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- tests/local-database.test.js`
Expected: PASS, including write-failure rejection.

## Task 2: Lichess CSV Importer and Initial Shards

**Files:**
- Create: `scripts/import-lichess-puzzles.js`
- Create: `tests/puzzle-import.test.js`
- Create: `tests/fixtures/lichess-puzzles.csv`
- Create: `public/puzzles/lichess/manifest.json`
- Create: `public/puzzles/lichess/*.json`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `parseLichessPuzzleRow(row, chessFactory) -> PuzzleRecord | null` and `writePuzzleBatches({ input, outputDir, snapshotDate, minRating, maxRating, minPopularity, themes, batchSize, limit }) -> Promise<CatalogManifest>`.
- `PuzzleRecord` fields: `{ id, source, sourceId, fen, moves, desc, rating, popularity, themes, sourceUrl, catalogVersion }`; `source` is `lichess`, `id` is `lichess:<PuzzleId>`, and `moves` is UCI.
- `CatalogManifest` fields: `{ catalogVersion, sourceSnapshotDate, batches: [{ id, file, count }] }`.
- `input` accepts a decompressed CSV file path or `-` for stdin. Document decompression with the system `zstd` command; do not add a browser-side decompressor.

- [ ] **Step 1: Write importer fixture tests**

Add a fixture with a legal setup move, an escaped/quoted field, one excluded rating/popularity row, one invalid move row, and at least two output batches. Assert the playable FEN is after the setup move, the remaining solution begins with the solver's move, source metadata is retained, and filtering/batch counts are exact.

- [ ] **Step 2: Run importer tests and verify they fail**

Run: `npm test -- tests/puzzle-import.test.js`
Expected: FAIL because importer exports and fixture-driven filtering do not exist.

- [ ] **Step 3: Implement the streaming importer**

Install `csv-parse` and `chess.js@0.10.3` as development dependencies. Stream CSV records rather than loading the source file into memory. Validate the six-field FEN, apply the first UCI setup move using Chess.js, retain subsequent UCI moves, filter by configured rating/popularity/theme options, and emit deterministic versioned shards plus a manifest containing `snapshotDate`. For the initial catalog, generate a small curated set with the configured filters and limit; never add the source dump itself to the repository.

- [ ] **Step 4: Run importer tests and verify they pass**

Run: `npm test -- tests/puzzle-import.test.js`
Expected: PASS for quoted CSV, setup normalization, filtering, invalid lines, and shard counts.

## Task 3: Puzzle Catalog Service and Batch Loading

**Files:**
- Create: `src/services/puzzle-catalog.js`
- Create: `tests/puzzle-catalog.test.js`
- Modify: `src/data/puzzles.js`

**Interfaces:**
- Consumes: `LocalDatabase` from Task 1 and `CatalogManifest`/`PuzzleRecord` from Task 2.
- Produces: `createPuzzleCatalog({ builtIns, repository, fetchImpl = fetch, manifestUrl }) -> PuzzleCatalog`.
- `PuzzleCatalog` exposes `list({ themes, minRating, maxRating } = {})`, `loadNextBatch()`, `getRecommendation({ themes, targetRating } = {})`, and `clearLocalData()`.
- `loadNextBatch()` returns `{ added, updated, skipped, batchId }` and persists the batch marker only after all puzzle writes succeed.
- `getRecommendation()` returns a matching unattempted puzzle nearest `targetRating`, prioritizing higher popularity; it returns `null` when no candidate exists.

- [ ] **Step 1: Write catalog service tests**

Test built-in plus imported composition, theme/rating filtering, source-ID deduplication without clearing attempts, selection of the nearest unattempted/high-popularity candidate, fallback to the least recently attempted candidate, and preservation of the local catalog when `fetchImpl` rejects.

- [ ] **Step 2: Run catalog tests and verify they fail**

Run: `npm test -- tests/puzzle-catalog.test.js`
Expected: FAIL because `createPuzzleCatalog()` does not exist.

- [ ] **Step 3: Migrate built-ins and implement catalog operations**

Assign stable IDs `builtin-001` through `builtin-004`, convert each current SAN solution to UCI, and keep its current description. Merge bundled and IndexedDB records by ID. Fetch one manifest shard at a time; on failure leave all local records and batch markers unchanged. Recommendation selection uses only locally available records and records attempts through `LocalDatabase`.

- [ ] **Step 4: Run catalog tests and verify they pass**

Run: `npm test -- tests/puzzle-catalog.test.js`
Expected: PASS for built-in preservation, deduplication, recommendation, and offline behavior.

## Task 4: UCI Puzzle Runner and User-Facing Loading

**Files:**
- Create: `src/services/puzzle-runner.js`
- Create: `tests/puzzle-runner.test.js`
- Modify: `src/app/game-controller.js`
- Modify: `index.html`
- Modify: `style.css`
- Create or update: `tests/puzzles.test.js`

**Interfaces:**
- Consumes: `PuzzleCatalog` from Task 3.
- Produces: `parseUciMove(uci) -> { from, to, promotion? }`, `moveToUci(move) -> string`, and `applyUciMove(game, uci) -> Move | null` in `src/services/puzzle-runner.js`. The existing puzzle workflow operates on canonical UCI moves for both built-in and imported tasks; the puzzle tab exposes explicit load-more, load-status, and clear-local-data actions.

- [ ] **Step 1: Add puzzle-runner tests**

In `tests/puzzle-runner.test.js`, test parsing ordinary and promotion UCI, rejecting malformed UCI, converting legal move objects to UCI, and applying an opponent UCI reply through a Chess.js-compatible fake game. In `tests/puzzles.test.js`, require stable ID, playable six-field FEN, nonempty UCI line, and description for built-ins.

- [ ] **Step 2: Run puzzle tests and verify they fail**

Run: `npm test -- tests/puzzle-runner.test.js tests/puzzles.test.js`
Expected: FAIL because the runner and built-in data still use SAN strings.

- [ ] **Step 3: Wire the catalog to the puzzle tab**

Inject the catalog and puzzle runner into the controller. Load a random puzzle from the combined catalog, compare user moves after normalizing `{ from, to, promotion }` to UCI, and execute opponent replies from UCI coordinates. Add `Загрузить ещё задачи` with loading/success/error status and `Очистить локальные данные` wired to `catalog.clearLocalData()`; do not load external data automatically on startup. Clearing removes IndexedDB user data but leaves bundled puzzles intact.

- [ ] **Step 4: Run puzzle tests and verify they pass**

Run: `npm test -- tests/puzzle-runner.test.js tests/puzzles.test.js`
Expected: PASS for built-in and imported UCI lines.

- [ ] **Step 5: Verify the complete catalog slice**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass, typecheck exits 0, Vite build succeeds. In the browser, load a batch, reload, confirm imported tasks remain, and simulate a failed fetch to confirm built-ins still work.

---

## Handoff to Post-Game Review Plan

The next plan consumes `LocalDatabase` game/review stores and the `PuzzleCatalog.getRecommendation()` interface. It must not rename those interfaces without updating this plan and the review plan together.