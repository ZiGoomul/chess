# Move Navigation Design Spec

## Overview
Add VCR-style controls (⏮ ⏪ ⏩ ⏭) and clickable history moves to allow the user to browse past positions in the game. This satisfies item #2 on the improvement roadmap.

## Architecture & Data Flow
- **State Tracking**: Add two new variables:
  - `historyFENs` (Array): Stores the FEN string for every half-move (ply). Index 0 is the starting position.
  - `currentViewPly` (Integer): Indicates which ply the board is currently displaying. Normal play occurs when `currentViewPly === historyFENs.length - 1`.
- **Navigation Mode**: 
  - Changing `currentViewPly` visually updates the board but does NOT alter the underlying `game` state.
  - The UI (arrows) is cleared during navigation so old arrows don't linger incorrectly.
- **Branching**:
  - If the user attempts to move a piece (`onDragStart`) while `currentViewPly` is not the latest, we will truncate the `game` object by calling `game.undo()` repeatedly until it matches `currentViewPly`.
  - The `historyFENs` array will also be truncated to match.
  - This turns the past position into the "present", allowing normal move generation and validation to proceed.

## UI / Components
- **Navigation Buttons**: A flex row appended to the bottom of `.history-column`.
  - Buttons: `|◀` (First), `◀` (Prev), `▶` (Next), `▶|` (Last).
- **Clickable Move List**: 
  - Bind click events to `.move-text` elements in the move history.
  - Clicking a move sets `currentViewPly` to the respective index (1-based from history, plus 0 for start) and updates the board.
- **Active Move Highlight**: 
  - Add a CSS class `.active-move` to visually distinguish the currently viewed move in the history list.

## Implementation Details
1. **HTML**: Insert the button row inside `<div class="history-column">` below `#moveHistoryList`.
2. **JS State**:
   - `var historyFENs = [game.fen()];`
   - `var currentViewPly = 0;`
3. **JS Handlers**:
   - Track FENs: Append `game.fen()` to `historyFENs` and update `currentViewPly` upon every valid move (player and bot).
   - Reset State: Reset `historyFENs` and `currentViewPly` on `clearBoardBtn` and `startPositionBtn`.
   - `goToPly(ply)`: Function to set `currentViewPly`, call `board.position(historyFENs[ply])`, update the active move highlight in the list, and clear arrows.
   - `onDragStart`: Add the truncation loop. If `currentViewPly < historyFENs.length - 1`, pop elements from `historyFENs` and call `game.undo()` until they match.
