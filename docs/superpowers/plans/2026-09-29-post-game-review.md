# Post-Game Review and Puzzle Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically review completed bot games, save reviewable reports locally, and recommend an appropriate puzzle from the local puzzle catalog.

**Architecture:** Complete games are snapshotted once and persisted through the LocalDatabase contract from the puzzle-catalog plan. A dedicated Stockfish worker evaluates saved FENs sequentially; a pure analysis layer selects critical human moves and conservatively classifies supported motifs. A coordinator persists the report and asks PuzzleCatalog for a theme/rating match, while a small UI view renders progress and lets users revisit saved reviews.

**Tech Stack:** JavaScript ESM controller and UI, TypeScript review service, existing Stockfish 10.0.2 Web Worker/UCI protocol, IndexedDB repository from the puzzle-catalog plan, Vite, and the existing `node:test` suite through `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-29-game-review-puzzle-training-design.md`

**Prerequisite Plan:** `docs/superpowers/plans/2026-09-29-puzzle-catalog-import.md` must be completed first; this plan consumes its `LocalDatabase` and `PuzzleCatalog` interfaces.

## Global Constraints

- Review only completed games against the bot; never trigger review for editor positions or puzzle-solving sessions.
- Record completion for chess terminal results and clock timeouts, and make completion idempotent.
- Persist local PGN/game records and reports through `LocalDatabase`; do not add accounts, cloud sync, or a backend.
- Use a dedicated review worker so analysis cannot consume bot or hint worker responses.
- Evaluate from the player's perspective, flag initial losses of at least 0.8 pawns plus forced-mate changes, and return no more than three critical moments.
- Use motif-specific puzzles only for deterministic, fixture-tested high-confidence themes; otherwise use the catalog's difficulty-matched fallback without claiming an exact match.
- Do not create commits unless explicitly requested. Run `npm test`, `npm run typecheck`, and `npm run build` after relevant changes.

## Review Focus

- Timeout must stop the clock, freeze further moves, save one result, and trigger one review; pin with `completes a timed-out bot game exactly once` in Task 1.
- A terminal move by either player must not be followed by a delayed bot move or duplicate completion; pin with `does not request a bot move after terminal completion` in Task 1.
- Evaluation changes must be converted from UCI side-to-move perspective before scoring the human player's move; pin with `normalizes evaluations for white and black movers` in Task 3.
- A canceled or stale worker response must not replace the active report; pin with `ignores stale review responses after cancellation` in Task 2.
- No critical moments, no supported motif, or no matching puzzle must still produce a saved review with a truthful fallback/empty recommendation state; pin with `persists a completed report without a puzzle match` in Task 4.

---

## File Structure

- `src/services/engine-workers.js`: add a dedicated review worker alongside game and hint workers.
- `src/services/clock.js`: report timeout as structured game completion and expose timeout state.
- `src/services/game-completion.js`: coordinate one game snapshot, persistence, and review start.
- `src/services/game-review.ts`: sequential UCI evaluation, cancellation, progress, critical-moment selection, and motif classification.
- `src/ui/post-game-review.js`: render current/recent review states and user actions without owning analysis or storage logic.
- `src/app/game-controller.js`: compose clock, game completion, review, saved game restoration, and board navigation.
- `index.html` and `style.css`: add a non-blocking review panel/list consistent with the existing tabs and columns.
- `tests/clock.test.js`, `tests/game-completion.test.js`, `tests/game-review.test.js`, and `tests/post-game-review.test.js`: timeout, completion, UCI analysis, matching, and report persistence coverage.

## Task 1: Idempotent Game Completion and Timeout

**Files:**
- Modify: `src/services/clock.js`
- Create: `src/services/game-completion.js`
- Modify: `src/app/game-controller.js`
- Modify: `tests/clock.test.js`
- Create: `tests/game-completion.test.js`

**Interfaces:**
- `createClock` accepts optional `onTimeout({ winnerColor, loserColor })`; it calls it once, sets `timedOut`, stops its interval, and exposes a read-only `timedOut` getter.
- Produces: `createGameCompletionCoordinator({ repository, onStartReview, now, createId }) -> { beginGame(metadata), completeGame(outcome), currentGameId }`.
- `beginGame(metadata)` captures `{ startingFen, humanColor, botLevel, timeControl }` and returns a stable game ID.
- `completeGame(outcome)` consumes `{ pgn, fens, moves, result, endReason }`, writes one `GameRecord` through `repository.games.put(record)`, then invokes `onStartReview(record)`. Repeated completion for the same active ID returns the existing record and performs no second write/review start.
- `GameRecord` fields are `{ id, startedAt, completedAt, startingFen, fens, moves, pgn, humanColor, botLevel, result, endReason, timeControl }`.

- [ ] **Step 1: Write timeout tests**

In `tests/clock.test.js`, inject deterministic `now`, `setInterval`, and `clearInterval` dependencies. Test that flag fall calls `onTimeout` once with the correct winner/loser, freezes the clock, and ignores subsequent ticks.

- [ ] **Step 2: Run the focused clock test and verify it fails**

Run: `npm test -- tests/clock.test.js`
Expected: FAIL because `createClock` has no timeout callback or injectable timer functions.

- [ ] **Step 3: Implement structured timeout behavior**

Extend `createClock` with the optional callback and injected timer functions, preserving current defaults. Set `timedOut` before invoking the callback, prevent `startClock()` and `addIncrement()` after flag fall, and reset the flag only when a new clock setting is applied.

- [ ] **Step 4: Run the focused clock test and verify it passes**

Run: `npm test -- tests/clock.test.js`
Expected: PASS for existing formatting and new timeout behavior.

- [ ] **Step 5: Write completion-coordinator tests**

In `tests/game-completion.test.js`, use mock repository/review callbacks to assert that `beginGame()` creates metadata, `completeGame()` persists the PGN/FEN snapshot before starting review, and duplicate completion writes/starts review exactly once.

- [ ] **Step 6: Run coordinator tests and verify they fail**

Run: `npm test -- tests/game-completion.test.js`
Expected: FAIL because the coordinator module does not exist.

- [ ] **Step 7: Implement the completion coordinator and controller wiring**

Implement `createGameCompletionCoordinator()` in `src/services/game-completion.js`. In `game-controller.js`, begin a record on the first legal human move in bot mode; capture `historyFENs` and verbose moves before state can be reset; complete after `game.in_checkmate()`/`game.in_draw()` or the clock callback; and set a finished guard so `onDragStart` and delayed `makeBotMove()` cannot continue a completed game. Do not begin/complete records in editor or puzzle mode.

- [ ] **Step 8: Run the focused completion tests and verify they pass**

Run: `npm test -- tests/clock.test.js tests/game-completion.test.js`
Expected: PASS, including one completion for timeout and chess-terminal outcomes.

## Task 2: Dedicated Review Worker and Sequential UCI Evaluation

**Files:**
- Modify: `src/services/engine-workers.js`
- Create: `src/services/game-review.ts`
- Create: `tests/game-review.test.js`

**Interfaces:**
- `createEngineWorkers()` adds `review` and returns `{ game, hints, review, terminate() }`; `terminate()` terminates all workers and revokes the Blob URL once.
- `PositionEvaluation` is `{ cp: number | null, mate: number | null, bestMove: string | null }`.
- `ReviewProgress` is `{ completed: number, total: number }`.
- `createGameReviewService({ worker, skillLevel = 20, searchDepth = 10 }) -> { analyze(record, onProgress), cancel() }`.
- `analyze(record, onProgress)` evaluates each FEN sequentially and resolves a `ReviewReport` with status `complete`, `cancelled`, or `error`; one worker search at a time.
- `parseReviewEvaluation(line) -> PositionEvaluation | null` accepts UCI `info ... score cp|mate ... pv ...` lines and ignores unrelated output.

- [ ] **Step 1: Write parser and worker lifecycle tests**

In `tests/game-review.test.js`, test centipawn/mate parsing, ignoring malformed lines, sequential `position fen`/`go depth 10` requests, progress counts, and that review workers are independent of bot/hint workers.

- [ ] **Step 2: Run review tests and verify they fail**

Run: `npm test -- tests/game-review.test.js`
Expected: FAIL because the parser and review service do not exist.

- [ ] **Step 3: Implement the review worker service**

Add the third worker in `engine-workers.js`. In `game-review.ts`, serialize searches: set the configured skill level, send `position fen <fen>`, then `go depth 10`; capture the latest score line for that search and finish it at `bestmove`. Report progress after each FEN.

- [ ] **Step 4: Add cancellation and stale-response handling**

Track one active review ID. `cancel()` sends `stop`, marks the report cancelled, and ignores any remaining info/bestmove lines from the canceled search. Do not let a canceled search complete or mutate a later report.

- [ ] **Step 5: Run review tests and verify they pass**

Run: `npm test -- tests/game-review.test.js`
Expected: PASS, including cancellation and stale worker-response cases.

## Task 3: Critical Moments, Motifs, and Puzzle Selection

**Files:**
- Modify: `src/services/game-review.ts`
- Modify: `tests/game-review.test.js`

**Interfaces:**
- Produces: `toWhitePerspective(evaluation, fenTurn) -> NormalizedEvaluation`.
- Produces: `findCriticalMoments({ record, evaluations, thresholdCp = 80, limit = 3 }) -> CriticalMoment[]`.
- Produces: `classifySupportedMotif(moment) -> { themes: string[], confidence: 'high' } | null`.
- Consumes: `PuzzleCatalog.getRecommendation({ themes, targetRating })` from the puzzle-catalog plan.
- `CriticalMoment` fields are `{ ply, move, lossCp, before, after, bestMove, motif }`.

- [ ] **Step 1: Write pure analysis tests**

Test white/black perspective normalization, a loss exactly below/at/above the 80-centipawn threshold, forced-mate-to-non-mate changes, ranking/capping at three human moves, and deterministic motif/null outcomes.

- [ ] **Step 2: Run analysis tests and verify they fail**

Run: `npm test -- tests/game-review.test.js`
Expected: FAIL because normalization, critical-moment selection, and motif classification are not implemented.

- [ ] **Step 3: Implement critical-moment scoring**

Normalize each UCI score using the analyzed FEN's side to move, compare before/after values from the human mover's perspective, include forced-mate changes, keep only losses meeting the 80-centipawn threshold, and return the three largest losses in descending order.

- [ ] **Step 4: Implement conservative motif classification and recommendation**

Classify only deterministic, fixture-backed forced-mate and clear material-gain cases to supported Lichess themes. Return `null` for every uncertain case. Ask PuzzleCatalog for an unattempted theme/rating match; when there is no confident theme, request the documented difficulty-matched fallback using the bot-level rating mapping.

- [ ] **Step 5: Run analysis tests and verify they pass**

Run: `npm test -- tests/game-review.test.js`
Expected: PASS for perspective, thresholds, mate transitions, top-three selection, motif confidence, and fallback cases.

## Task 4: Persisted Reports, Review UI, and Saved-Game Replay

**Files:**
- Create: `src/ui/post-game-review.js`
- Modify: `src/app/game-controller.js`
- Modify: `index.html`
- Modify: `style.css`
- Create: `tests/post-game-review.test.js`

**Interfaces:**
- `createPostGameReviewCoordinator({ repository, reviewService, puzzleCatalog, onProgress, onReport }) -> { start(record), cancel(gameId), retry(gameId) }`.
- `start(record)` persists `analyzing`, runs review, persists the final report, attaches an optional puzzle recommendation, and resolves only after storage succeeds.
- The view accepts `{ currentReview, recentGames, onSelectMoment, onOpenGame, onRetry, onCancel, onSolvePuzzle }` and renders state; it does not own storage or engine logic.
- Selecting a saved game restores its PGN/FEN snapshots in read-only review mode; starting a new bot game exits that mode.

- [ ] **Step 1: Write coordinator and view-state tests**

Test persisted `analyzing` then `complete` transitions, retry after engine error, no critical moments, no matching puzzle, cancellation, and selecting a saved report without mutating its stored game record.

- [ ] **Step 2: Run post-game review tests and verify they fail**

Run: `npm test -- tests/post-game-review.test.js`
Expected: FAIL because the review coordinator and view-state model do not exist.

- [ ] **Step 3: Implement report coordinator and persistence**

Use the Task 1 `LocalDatabase` game/review methods and Task 3 review/catalog interfaces. Save report status transitions; on a storage failure, show an error and do not claim the review was saved. Store the suggested puzzle ID and classification/fallback reason.

- [ ] **Step 4: Implement non-blocking review and recent-games UI**

Add a review panel with progress, cancel, retry, up to three critical moments, best continuation, and one puzzle action. Add a recent-games list backed by `games.listRecent()`. Selecting a moment navigates to the saved FEN; selecting an older game restores it as read-only. Preserve the separate puzzle tab and its catalog actions.

- [ ] **Step 5: Wire terminal results and timeout to review**

Connect Task 1's single completion callback to the coordinator. Ensure a game record is persisted before analysis starts, and both timeout and chess terminal outcomes trigger exactly one review. Keep puzzle/editor flows excluded.

- [ ] **Step 6: Run focused tests and verify they pass**

Run: `npm test -- tests/clock.test.js tests/game-completion.test.js tests/game-review.test.js tests/post-game-review.test.js`
Expected: PASS for terminal events, timeouts, cancellation, recommendation fallback, and report persistence.

- [ ] **Step 7: Verify the whole feature**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass, typecheck exits 0, Vite build succeeds. In the browser, complete a bot game by checkmate and by timeout, cancel/retry a review, navigate to a critical moment, solve a suggested puzzle, reload, and reopen the saved game. Confirm editor and puzzle completion never trigger a game review.

---

## Execution Order

1. Complete `2026-09-29-puzzle-catalog-import.md` and preserve its public interfaces.
2. Complete Tasks 1–3 here in order; their outputs are consumed by Task 4.
3. Run the full verification and browser scenarios in Task 4 before considering the feature complete.