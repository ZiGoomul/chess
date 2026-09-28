# Puzzles Mode Design Spec

## Overview
Add a "Puzzles" (Задачи) mode to the application. This includes a new sidebar tab, a local hardcoded database of chess puzzles, and logic to validate the user's moves against the puzzle solution. Satisfies item #4 on the roadmap.

## Architecture & Data
- **Puzzle Database**: A global array `puzzleDatabase` containing objects:
  ```javascript
  {
    fen: "...",
    moves: ["e4", "e5", ...], // Standard Algebraic Notation (SAN)
    description: "Мат в 2 хода"
  }
  ```
- **State Variables**:
  - `isPuzzleMode` (Boolean): True when a puzzle is active. Disables standard bot play.
  - `currentPuzzle` (Object): Reference to the active puzzle.
  - `currentPuzzleStep` (Integer): Index of the next expected move in the array.
  - `solvedPuzzles` (Integer): Tracks number of solved puzzles.

## Validation Logic
- Inside `onDrop`, if `isPuzzleMode` is true:
  - Generate the intended user move to get its SAN representation.
  - Compare the user's move's SAN string to `currentPuzzle.moves[currentPuzzleStep]`.
  - **If correct**: 
    - Accept the move, update board.
    - Increment `currentPuzzleStep`.
    - If `currentPuzzleStep` equals `moves.length`, the puzzle is solved! Play success sound, show success message.
    - Otherwise, it's the opponent's turn. Use `setTimeout(500ms)` to automatically play `currentPuzzle.moves[currentPuzzleStep]`, increment step, and update board.
  - **If wrong**:
    - Undo the move (`return 'snapback'`).
    - Flash an error message in the UI ("Неверный ход, попробуйте еще раз!").

## UI / Components
- **Sidebar Tab**: 
  - Add `<button class="tab-btn" data-tab="tab-puzzles">Задачи</button>` to the tabs header.
  - Add `<div class="tab-content" id="tab-puzzles" style="display: none; flex-direction: column; gap: 15px;">` in the sidebar.
- **Tab Content Elements**:
  - Large button: `[Следующая задача]`
  - Score counter: `Решено: 0`
  - Feedback text area: `[Описание задачи / статус решения]`
- **Board Orientation**:
  - When a puzzle is loaded, the board automatically flips (`board.orientation(...)`) so the player is at the bottom.

## Implementation Details
1. **HTML Modification**: Insert the new tab button and tab content in `index.html`.
2. **JS Modification**:
   - Define `puzzleDatabase` and state variables.
   - Implement `loadRandomPuzzle()`.
   - Modify `onDragStart` to prevent dragging opponent pieces during puzzle.
   - Modify `onDrop` to branch into Puzzle Validation logic instead of Bot/Free play logic.
   - Attach listeners to the new tab and buttons.
