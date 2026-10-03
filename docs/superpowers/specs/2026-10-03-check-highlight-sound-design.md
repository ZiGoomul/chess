# Design Specification: Check Highlighting and Sound

**Date:** 2026-10-03  
**Status:** Approved  
**Topic:** Check visual highlighting and sound alert with Web Audio fallback  

## 1. Overview
When a king is placed in check (or checkmate) during gameplay (against a bot, editor, or puzzles), the board must prominently highlight the king's square with a radial glow and subtle pulse animation (in the style of Chess.com/Lichess), and an auditory alert must play. If external audio assets fail to load or the app is offline, a synthesized Web Audio API sound will play as a fallback.

## 2. Requirements & Behavior

### 2.1 Visual Highlighting
- When the position is in check (`game.in_check()` or `game.in_checkmate()`):
  - Identify the square of the king whose turn it is to move.
  - Apply the CSS class `.in-check` to that square element (`[data-square="..."]` and `.square-...`).
  - When not in check, remove the `.in-check` class.
- Highlighting must persist across Chessboard.js lifecycle events:
  - After user drag-and-drop (`onSnapEnd`), when `board.position()` rerenders DOM squares.
  - After `game:move-made` animations.
  - When stepping through move history / plies.
- Highlighting styling:
  - Radial gradient centered on the king's square with soft red glow and borders.
  - Subtle breathing/pulse animation via CSS keyframes (`@keyframes king-check-pulse`).

### 2.2 Sound Behavior
- When a move results in check:
  - If the game ends (checkmate / draw), play `gameEnd`.
  - Else if the position is in check (`game.in_check()`), play `check` with highest move-sound priority (over capture and castling).
  - Else if capture, play `capture`.
  - Else if castling, play `castle`.
  - Otherwise, play standard `move`.
- Sound playback and fallback:
  - Attempt playback of the Chess.com check audio asset.
  - If loading fails, network is offline, or `.play()` rejects, fallback to an in-browser Web Audio API synthesizer.
  - Web Audio fallback generates a distinct, pleasant percussive dual-frequency alert tone (~620Hz down to ~440Hz, decaying over 140ms).

## 3. Architecture & Code Changes

### 3.1 `styles/board.css`
- Update `.in-check` selector to style the square with:
  - Inset box-shadow and radial gradient glow.
  - Keyframe animation `king-check-pulse` (opacity and shadow oscillation).

### 3.2 `src/ui/board-view.js`
- Track the current position / game instance in `boardView` state.
- In `highlightCheck(positionGame)`:
  - Clear existing `.in-check` classes.
  - If `positionGame` is in check, locate king of `positionGame.turn()` and add `.in-check`.
- Re-apply `highlightCheck()` inside `onSnapEnd` and whenever `board.position(...)` is invoked.

### 3.3 `src/services/audio.js`
- Ensure `playSoundForMove(move)` prioritizes `check` whenever `game.in_check()`.
- Add `createWebAudioSynthesizer()` helper inside `audio.js`:
  - Lazily instantiates `AudioContext` on first user interaction.
  - Generates synthetic check tone when standard check sound fails or errors.
- Hook audio error / rejection handling to trigger the Web Audio fallback.

## 4. Verification & Testing
- Unit tests:
  - Verify sound priority logic in `audio.js` (check takes precedence over capture/castle if king is checked).
  - Verify `highlightCheck` logic identifies correct king square for both white and black.
- Manual testing:
  - Play moves that deliver check against the bot.
  - Verify king square glows red and pulses.
  - Verify check sound triggers.
  - Drag and drop piece to deliver check: verify highlight does not disappear after snap.
  - Verify typecheck (`npm run typecheck`) and tests (`npm test`) pass.
