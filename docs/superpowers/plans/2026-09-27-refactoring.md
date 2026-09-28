# Refactoring Plan

## Completed

- Set up Vite, Node tests, and npm-managed development tools.
- Extracted audio, clock, worker creation, puzzle data, move-history UI, and Stockfish coordination behind explicit module APIs.
- Started incremental TypeScript adoption with `src/services/chess-engine.ts` and strict isolated typechecking.
- Updated tooling to Vite 8 and TypeScript 7; added workspace Context7 MCP configuration and project guidance.
- Added tests for UCI parsing, canceled searches, clock formatting, and puzzle data.

## Next

1. Add types to the puzzle model and clock settings, then convert those modules individually.
2. Extract board/game transitions from `src/app/game-controller.js` into a game controller with a typed state boundary.
3. Add integration tests for invalid FEN, branching history, timer reset, and full human/engine turns.
4. Decide whether to move CDN-loaded chess libraries to npm once their runtime and type versions are validated.
5. Add CI for typecheck, tests, and production build.

## Verification

Run `npm test`, `npm run typecheck`, and `npm run build` after each migration step. Keep the browser smoke checks for a human move, an engine reply, a hint, a puzzle, and history navigation.
