# Chess Timer Design Spec

## Overview
Add a fully functional chess timer to the application. It includes UI configuration for base time and increment, dual clocks above and below the board, and game-over logic on time exhaustion. Satisfies item #5 on the roadmap.

## Architecture & Data
- **State Variables**:
  - `timerEnabled` (Boolean): Master toggle for clocks.
  - `timeWhite` (Integer): Milliseconds remaining for White.
  - `timeBlack` (Integer): Milliseconds remaining for Black.
  - `incrementMs` (Integer): Milliseconds added per move.
  - `clockInterval` (Number): The setInterval ID.
  - `lastTickTime` (Number): High-res timestamp of the last tick (avoids JS drift).
  - `clockRunning` (Boolean): True if clock is actively ticking.

## Logic Flow
1. **Initialization**: When "Игра на время" is enabled, both clocks parse the base time (e.g., 5 min = 300,000 ms).
2. **Starting**: Clocks remain paused at 0.0. The moment White makes the first move (human or bot), `clockRunning` becomes true, and `lastTickTime` is set.
3. **Ticking**: A 100ms interval subtracts `Date.now() - lastTickTime` from the active turn's time.
4. **Move Completion**: Upon any valid move, if the game has started, add `incrementMs` to the player who just moved.
5. **Time Out**: If `timeWhite <= 0` or `timeBlack <= 0`, stop the clock, declare game over, and show the overlay.

## UI / Components
- **Clock Elements**:
  - Add `<div id="topClock" class="chess-clock" style="display: none;">05:00</div>` inside `#topMaterial`.
  - Add `<div id="bottomClock" class="chess-clock" style="display: none;">05:00</div>` inside `#bottomMaterial`.
  - Use Flexbox `margin-left: auto;` to push them to the right side of the material rows.
  - Add a red `.danger` style when time is under 10 seconds.
- **Settings Panel**:
  - In `#tab-play`, add a timer section:
    - Toggle checkbox for enabling/disabling.
    - Two `<select>` elements for Base Time and Increment.
- **Orientation Flipping**:
  - If `board.orientation() === 'white'`, bottom clock shows `timeWhite`, top shows `timeBlack`.
  - If `board.orientation() === 'black'`, bottom clock shows `timeBlack`, top shows `timeWhite`.

## Implementation Details
1. **HTML/CSS**: Insert settings into the sidebar, clocks into the material rows. Add `.chess-clock` CSS.
2. **JS Functions**:
   - `resetClocks()`: Applies settings, resets MS counters, stops interval.
   - `startClock()`: Kicks off the `setInterval`.
   - `stopClock()`: Clears interval.
   - `updateClockUI()`: Formats MS to `MM:SS` (or `SS.d` if < 10s) and renders to top/bottom based on orientation.
   - `tickClock()`: The core loop.
3. **Event Hooks**:
   - Tie `resetClocks` to settings change and new game button.
   - Tie `startClock` to `onDrop` / bot move if not already running.
   - Add increment logic immediately after a move completes.
   - Hide clocks in Puzzle Mode.
