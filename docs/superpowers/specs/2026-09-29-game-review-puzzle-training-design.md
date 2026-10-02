# Game Review and Puzzle Training Design

## Status

Draft for user review. This document records the agreed product direction; implementation has not started.

## Goal

Connect bot games and puzzle practice into one learning loop. After a completed game against the bot, the app reviews the player's moves, highlights a small number of critical moments, and suggests a puzzle related to a detected weakness. Completed games, review reports, imported puzzles, and puzzle attempts are stored locally in the browser so the user can return to them later.

The app remains a client-side project with no account system or application server. The user has approved network access to load puzzle batches. The current four built-in puzzles remain available and are never replaced by imported data.

## User Workflow

### Bot game review

1. A completed game against the bot is saved locally as a PGN record with its move sequence, human color, result, end reason, and time control. Completion is signaled by a chess terminal result or by the clock service on timeout; it does not depend only on `chess.js` reporting `game_over()`.
2. A background review starts automatically. It analyzes positions from the saved game without blocking navigation or starting another game.
3. The review view shows progress and up to three significant mistakes or missed opportunities. Selecting an item navigates the board and move history to that position and shows the engine's best continuation.
4. When a relevant motif can be classified with sufficient confidence, the app offers a puzzle carrying that theme. If classification is uncertain, it offers a popular puzzle near the player's estimated difficulty and labels it as general practice rather than claiming an exact match.
5. The user can skip the review or puzzle. The result and puzzle attempt remain available in local history.

Review does not start for editor positions or while solving a puzzle. A draw or timeout in a bot game still counts as a completed game. If analysis is interrupted or fails, the saved game remains available and the app reports that review is incomplete.

### Puzzle catalog

The puzzle tab continues to serve built-in and previously imported puzzles while offline. It offers an explicit action to load another available batch. The app does not download the full upstream database during startup or after each game.

Imported puzzle records retain their source ID, source URL, rating, popularity, themes, and catalog version. Re-importing a batch updates or skips matching source IDs instead of creating duplicate tasks.

## Puzzle Source and Import

The upstream source is the [Lichess puzzle database](https://database.lichess.org/#puzzles), published as a CSV snapshot under CC0. The CSV includes `PuzzleId`, `FEN`, `Moves`, `Rating`, `Popularity`, and `Themes` fields. The published snapshot contains millions of puzzles, so it is not appropriate to fetch or parse in full in the browser.

A project-side importer reads the upstream compressed CSV and produces versioned, filtered JSON batches. The importer accepts rating bounds, selected themes, and a batch-size limit; it records the upstream snapshot date and source ID in each output batch. Only standard chess puzzles supported by the app are included. The user-facing app fetches these small batches from the app's static asset host and merges them into its local catalog.

Lichess puzzle FEN is the position before the setup move; the first UCI move is that setup move, and the second move begins the solution. The importer must apply the setup move and store a playable position with the remaining solution. UCI is the canonical move format in the puzzle catalog. Existing built-in SAN solutions are migrated to UCI, the puzzle runner normalizes a user's legal move to UCI for comparison, and opponent replies are applied from UCI coordinates. Puzzle interaction therefore does not branch on source.

If a batch cannot be fetched, the app keeps the built-in and already imported puzzles usable, shows a retryable error, and does not block the game or review workflow.

## Game Analysis and Recommendations

The review service consumes the game's ordered positions and moves and evaluates the positions using a dedicated Stockfish worker. The worker is separate from bot-move and hint searches so review cannot replace or consume an active game search. Review is sequential, cancellable, and reports progress.

Evaluation deltas are calculated from the perspective of the player who made each move. The initial review flags moves with at least 0.8 pawns of evaluation loss, plus forced-mate changes, and ranks them by loss. It presents no more than the three largest qualifying moments. These thresholds are centralized and covered by fixtures so they can be adjusted without changing UI code.

Motif classification is deliberately conservative. The first version classifies only themes supported by deterministic, fixture-tested rules using the position and engine continuation, such as forced mate or a clear tactical material gain. A theme is considered high-confidence only when one of those rules matches; otherwise the classifier returns no theme. A motif-specific puzzle is used only for a returned theme. The fallback selects an unattempted, popular puzzle nearest the difficulty estimate mapped from the selected bot level; if none remain, it may repeat the least recently attempted matching candidate. The UI must not describe this fallback as an exact match to the user's mistake.

Each review report records the game ID, analysis status, engine/configuration version, per-move evaluation data, selected critical moments, classification confidence, and any suggested puzzle ID. If the engine fails or the game has no qualifying critical moments, the game is still saved; the report explains that no critical moments were found or that analysis could not finish. In the latter case, the user may retry.

## Local Persistence

IndexedDB is the local persistence boundary for:

- Completed bot games, including PGN, starting FEN, time-control metadata, and completion result.
- Review reports and their status, including incomplete or retryable reviews.
- Built-in and imported puzzle metadata and solutions, keyed by stable puzzle ID.
- Puzzle attempts, including completion state and timestamp.
- Catalog batch version and import state, to resume safely and avoid duplicate imports.

There is no cloud synchronization or account identity. A user-facing clear-data action removes locally stored games, reports, imported puzzles, and attempts. Built-in puzzles remain available from the application bundle after local data is cleared.

## Architecture Boundaries

- `src/app/game-controller.js` remains the composition point for detecting completed bot games and connecting game state to UI.
- A game-review service owns evaluation sequencing, cancellation, progress, and critical-moment calculation; it does not access the DOM.
- The existing chess-engine service remains responsible for UCI handling. Review receives its own worker instance or isolated worker session.
- A puzzle-catalog service owns the built-in/imported catalog, batch loading, source-ID deduplication, and persistence-facing operations.
- An IndexedDB repository owns browser storage and is injected into services rather than accessed from domain logic.
- A post-game review view renders progress, critical moments, recommendations, and retry/skip actions without owning game or storage rules.
- The importer is a maintenance/build tool. It converts the upstream dump into a compact app format and does not run in the user's browser.

The project keeps its current board library. Replacing it with Chessground is out of scope; Chessground is GPL-3.0 and would require a separate licensing decision for the combined application.

## Error Handling and Performance

- Engine review is cancellable and bounded by a centralized per-position budget. The UI exposes progress and a cancel action.
- Review errors are stored with the game and can be retried; they do not erase the game or affect future games.
- Puzzle batch fetch errors preserve all local tasks and provide a retry action.
- A missing suggested puzzle does not block the report; the user can continue to the puzzle tab or dismiss the recommendation.
- Storage failures are surfaced explicitly. The app must not claim that a game or imported task was saved until IndexedDB confirms the write.
- Network data is only used for an explicit catalog batch load. Gameplay, saved history, built-in puzzles, and existing imported puzzles do not require that request.

## Out of Scope

- Accounts, cloud sync, multiplayer, and a custom application backend.
- Downloading or indexing the complete six-million-puzzle database in the browser.
- Replacing the board UI library.
- Full natural-language coaching or guaranteed detection of every chess motif.
- Review of editor positions or puzzle attempts as bot games.

## Acceptance Criteria

- Completing a bot game starts one review; editor and puzzle completion do not.
- A user can leave the review running, cancel it, and continue using the app.
- A completed report identifies up to three qualifying moves and selecting one navigates to its position.
- A high-confidence supported motif selects a puzzle with that theme; uncertain classifications use the documented difficulty-matched fallback.
- Loading an imported batch preserves all built-in puzzles, deduplicates by source ID, and records source metadata.
- Lichess setup moves are applied exactly once so the imported puzzle starts at the intended player-to-move position.
- Games, reports, imported puzzles, and puzzle attempts survive reload and can be removed through the clear-data action.
- With network access unavailable, existing games, reports, built-in puzzles, and previously imported puzzles remain usable.

## Verification Scope

- Unit tests for importer CSV parsing, Lichess FEN/setup-move normalization, UCI solution normalization, source-ID deduplication, evaluation loss, mate transitions, and motif confidence fallback.
- IndexedDB tests for save, load, retry state, duplicate imports, and clear-data behavior.
- Integration tests for bot-game completion triggering one review and excluding editor/puzzle modes.
- Browser checks for review progress/cancel, critical-moment navigation, recommendation and fallback UI, catalog loading, and offline/error states.
- Run the repository checks: `npm test`, `npm run typecheck`, and `npm run build`.