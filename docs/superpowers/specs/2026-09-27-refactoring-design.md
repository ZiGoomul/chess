# Refactoring Design Spec

## Overview
Replace the global single-file controller with ES modules that have explicit dependencies and can be tested independently. Vite serves the application; opening `index.html` directly with `file://` is no longer the supported development workflow.

## Current Structure
- `src/main.js`: Vite entry point.
- `src/app/game-controller.js`: board setup, game orchestration, and DOM event wiring. This remains the largest module and is the next extraction target.
- `src/services/audio.js`: sound playback.
- `src/services/clock.js`: clock state and display.
- `src/services/engine-workers.js`: Stockfish worker creation.
- `src/services/chess-engine.ts`: typed UCI parsing, search lifecycle, and stale-response handling.
- `src/data/puzzles.js`: puzzle definitions.
- `src/ui/move-history.js`: move list rendering and position navigation.
- `tests/`: Node test-runner unit tests.

## Module Rules
- Keep rules and state transitions out of DOM rendering modules.
- Pass dependencies through factory arguments or parameters; do not introduce shared globals.
- Keep puzzle content separate from puzzle interaction logic.
- Keep browser and worker APIs behind service modules.
- Do not maintain parallel active and legacy implementations.
- Migrate JavaScript modules to TypeScript incrementally, starting at isolated boundaries with tests.

## Execution Strategy
To minimize user risk of breaking the app during the refactor:
1. Extract audio, clock, worker creation, and puzzle data.
2. Extract move-history rendering and navigation.
3. Split engine message coordination and board/game transitions out of `game-controller.js`.
4. Add focused tests alongside each extraction.
5. Run `npm test`, `npm run typecheck`, and `npm run build`, then verify human moves, engine replies, puzzles, timers, and history navigation in the browser.
