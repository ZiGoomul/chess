# Check Highlighting and Sound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide clear visual highlighting of the king in check (persisting across board redraws) and ensure reliable sound alerts using the primary audio asset with an automatic Web Audio API synthesizer fallback.

**Architecture:** 
1. Pure domain functions in `src/domain/check-state.js` calculate checked king square coordinates and determine move sound types based on game state.
2. An enhanced audio service in `src/services/audio.js` provides reliable sound playback with an in-browser Web Audio fallback oscillator tone for checks.
3. CSS styles in `styles/board.css` render a pulsing radial glow on the checked king's square.
4. `src/ui/board-view.js` and `src/app/game-orchestrator.js` integrate the domain check calculations with chessboard lifecycle events (`onSnapEnd`, `game:move-made`, ply changes) to guarantee highlights are never lost during animations.

**Tech Stack:** JavaScript (ES modules), CSS3 Animations, Chess.js, Chessboard.js, Web Audio API, Node.js test runner (`tsx --test`).

---

### Task 1: Domain Logic for Check State and Sound Determination

**Files:**
- Create: `src/domain/check-state.js`
- Test: `tests/check-state.test.js`

- [ ] **Step 1: Write the failing test for check-state domain functions**

```javascript
// tests/check-state.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import Chess from 'chess.js';
const ChessCtor = Chess.Chess || Chess;

import { getKingSquareInCheck, determineMoveSound } from '../src/domain/check-state.js';

test('getKingSquareInCheck returns null when position is not in check', () => {
  const game = new ChessCtor();
  assert.equal(getKingSquareInCheck(game), null);
});

test('getKingSquareInCheck returns black king square when black is in check', () => {
  const game = new ChessCtor();
  // Scholar's mate attack position: e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7# (mate/check)
  game.load('r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4');
  assert.equal(getKingSquareInCheck(game), 'e8');
});

test('getKingSquareInCheck returns white king square when white is in check', () => {
  const game = new ChessCtor();
  // White king on e1 in check by black queen on e4
  game.load('rnb1kbnr/pppp1ppp/8/8/4q3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1');
  assert.equal(getKingSquareInCheck(game), 'e1');
});

test('determineMoveSound prioritizes gameEnd for checkmate', () => {
  const game = new ChessCtor('r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4');
  const move = { flags: 'c', from: 'f3', to: 'f7' };
  assert.equal(determineMoveSound(game, move), 'gameEnd');
});

test('determineMoveSound prioritizes check over capture and normal moves', () => {
  const game = new ChessCtor();
  // White gives check with a capture
  game.load('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
  // Mock in_check on game
  game.in_check = () => true;
  game.in_checkmate = () => false;
  game.in_draw = () => false;
  const captureMove = { flags: 'c', from: 'e4', to: 'd5' };
  assert.equal(determineMoveSound(game, captureMove), 'check');
});

test('determineMoveSound returns capture, castle, or move when not in check', () => {
  const game = new ChessCtor();
  assert.equal(determineMoveSound(game, { flags: 'c' }), 'capture');
  assert.equal(determineMoveSound(game, { flags: 'k' }), 'castle');
  assert.equal(determineMoveSound(game, { flags: 'n' }), 'move');
  assert.equal(determineMoveSound(game, null), 'move');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/check-state.test.js`
Expected: FAIL ("Cannot find module '../src/domain/check-state.js'")

- [ ] **Step 3: Implement domain check logic**

```javascript
// src/domain/check-state.js
/**
 * Returns the board square ('a1'-'h8') of the king currently in check,
 * or null if the current position is not in check.
 *
 * @param {Object} game - chess.js instance
 * @returns {string|null}
 */
export function getKingSquareInCheck(game) {
  if (!game || typeof game.in_check !== 'function') return null;
  if (!game.in_check() && !(typeof game.in_checkmate === 'function' && game.in_checkmate())) {
    return null;
  }

  const turn = game.turn();
  const board = game.board();
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'k' && piece.color === turn) {
        return files[c] + (8 - r);
      }
    }
  }

  return null;
}

/**
 * Determines which sound type should play for the resulting position and move.
 * Priority: gameEnd > check > capture > castle > move
 *
 * @param {Object} game - chess.js instance representing position AFTER move
 * @param {Object|null} move - verbose move object from chess.js
 * @returns {'gameEnd'|'check'|'capture'|'castle'|'move'}
 */
export function determineMoveSound(game, move) {
  if (!game) return 'move';

  if ((typeof game.in_checkmate === 'function' && game.in_checkmate()) ||
      (typeof game.in_draw === 'function' && game.in_draw())) {
    return 'gameEnd';
  }

  if (typeof game.in_check === 'function' && game.in_check()) {
    return 'check';
  }

  if (move && move.flags) {
    if (move.flags.includes('c') || move.flags.includes('e')) {
      return 'capture';
    }
    if (move.flags.includes('k') || move.flags.includes('q')) {
      return 'castle';
    }
  }

  return 'move';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/check-state.test.js`
Expected: PASS (all 5 tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/domain/check-state.js tests/check-state.test.js
git commit -m "feat: add domain logic for check state and sound determination"
```

---

### Task 2: Audio Service with Web Audio API Fallback

**Files:**
- Modify: `src/services/audio.js`

- [ ] **Step 1: Update `src/services/audio.js` to use `determineMoveSound` and provide Web Audio fallback**

Replace `src/services/audio.js` with:
```javascript
import { determineMoveSound } from '../domain/check-state.js';

const SOUND_URLS = {
  move: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3',
  capture: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3',
  check: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3',
  castle: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/castle.mp3',
  gameEnd: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3',
  gameStart: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-start.mp3'
};

let sharedAudioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playSyntheticCheckSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  // Dual-frequency slide: distinctive sharp check tap
  osc.frequency.setValueAtTime(620, now);
  osc.frequency.exponentialRampToValueAtTime(420, now + 0.12);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.14);
}

export function createAudio(game) {
  const sounds = typeof window !== 'undefined'
    ? Object.fromEntries(
        Object.entries(SOUND_URLS).map(([name, url]) => [name, new Audio(url)])
      )
    : {};

  function playSound(type) {
    const sound = sounds[type];
    if (!sound) {
      if (type === 'check') playSyntheticCheckSound();
      return;
    }

    sound.currentTime = 0;
    const playPromise = sound.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        if (type === 'check') {
          playSyntheticCheckSound();
        }
      });
    }
  }

  function playSoundForMove(move, targetGame = null) {
    const activeGame = targetGame || game;
    const soundType = determineMoveSound(activeGame, move);
    playSound(soundType);
  }

  return { playSound, playSoundForMove, playSyntheticCheckSound };
}
```

- [ ] **Step 2: Run test suite to verify no regressions**

Run: `npm test`
Expected: PASS (all tests pass)

- [ ] **Step 3: Commit**

```bash
git add src/services/audio.js
git commit -m "feat: enhance audio service with Web Audio API check fallback"
```

---

### Task 3: Check Visual Highlighting and Pulse CSS

**Files:**
- Modify: `styles/board.css`

- [ ] **Step 1: Add animated radial glow styles for `.in-check` in `styles/board.css`**

Update `.in-check` in `styles/board.css`:
```css
/* Подсветка шаха королю (в стиле Chess.com / Lichess) */
.square-55d63.in-check {
    background: radial-gradient(ellipse at center, rgba(255, 0, 0, 0.85) 0%, rgba(231, 76, 60, 0.6) 42%, rgba(192, 57, 43, 0.3) 70%, transparent 100%) !important;
    box-shadow: inset 0 0 16px 5px rgba(231, 76, 60, 0.85) !important;
    animation: king-check-pulse 1.6s ease-in-out infinite alternate !important;
    z-index: 2 !important;
}

@keyframes king-check-pulse {
    0% {
        box-shadow: inset 0 0 10px 3px rgba(231, 76, 60, 0.7);
        filter: drop-shadow(0 0 2px rgba(231, 76, 60, 0.8));
    }
    100% {
        box-shadow: inset 0 0 20px 8px rgba(255, 50, 50, 0.95);
        filter: drop-shadow(0 0 8px rgba(231, 76, 60, 1));
    }
}
```

- [ ] **Step 2: Verify CSS builds cleanly**

Run: `npm run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add styles/board.css
git commit -m "style: add pulsing radial glow for check highlighting on board"
```

---

### Task 4: Board View Integration and Lifecycle Synchronization

**Files:**
- Modify: `src/ui/board-view.js`
- Modify: `src/app/game-orchestrator.js`

- [ ] **Step 1: Update `src/ui/board-view.js` to persist check highlight across re-renders**

Import `getKingSquareInCheck` from `../domain/check-state.js`.
In `createBoardView({ $, eventBus, store })`:
1. Maintain `currentCheckGame`:
```javascript
import { getLegalMovesForSquare, getSquareFromCoords } from '../domain/move-input.js';
import { getKingSquareInCheck } from '../domain/check-state.js';
```
2. Refactor `highlightCheck(positionGame)`:
```javascript
    var currentCheckGame = null;

    function highlightCheck(positionGame) {
        currentCheckGame = positionGame || (store ? store.getState().game : null);
        $('#myBoard .square-55d63').removeClass('in-check');
        if (!currentCheckGame) return;

        var kingSquare = getKingSquareInCheck(currentCheckGame);
        if (kingSquare) {
            $('#myBoard [data-square="' + kingSquare + '"], #myBoard .square-' + kingSquare).addClass('in-check');
        }
    }
```
3. In `onSnapEnd` config callback of `Chessboard`:
After `board.position(currentFen, false);`, re-apply:
```javascript
        if (currentCheckGame) {
            highlightCheck(currentCheckGame);
        }
```
4. In `eventBus.on('game:move-made')`:
Re-apply check highlight after `board.position()`:
```javascript
        if (data.game) {
            highlightCheck(data.game);
        }
```

- [ ] **Step 2: Update `src/app/game-orchestrator.js` to pass `game` to `game:move-made` and ensure `updateStatus` sync**

In `makeMove`:
Pass `game` in `eventBus.emit('game:move-made', { fen: game.fen(), move: move, game: game });`
In `bot:move-ready`:
Pass `game` in `eventBus.emit('game:move-made', { fen: game.fen(), move: botMove, game: game });`
In `eventBus.on('game:ply-changed')`:
Invoke `boardView.highlightCheck(payload.positionGame);`

- [ ] **Step 3: Run full test suite and typecheck**

Run: `npm test && npm run typecheck && npm run build`
Expected: All tests pass, typecheck clean, build clean.

- [ ] **Step 4: Commit**

```bash
git add src/ui/board-view.js src/app/game-orchestrator.js
git commit -m "feat: synchronize check highlighting with chessboard lifecycle"
```

---

### Task 5: Manual and Automated Verification

**Files:**
- Test: `tests/check-state.test.js`

- [ ] **Step 1: Run complete test suite**

Run: `npm test`
Expected: 54+ tests pass, 0 failures.

- [ ] **Step 2: Run type check**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Test Vite production build**

Run: `npm run build`
Expected: Clean build output in `dist/`.

- [ ] **Step 4: Verify dev server in browser**

Open: `http://localhost:5173/`
1. Make moves: 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# (or delivering check with 3. Qxf7+).
2. Confirm the checked king's square immediately pulses with the red radial glow.
3. Confirm the check sound triggers audibly.
4. Drag a piece while king is in check: confirm check highlight remains after drag-and-drop ends.
