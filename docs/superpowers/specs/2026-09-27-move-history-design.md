# Move History UI Design Spec

## Overview
Add a dedicated "Move History" panel to the chess application to display the list of moves made in the current game. This implements the first item in the project improvement roadmap.

## Architecture & Layout
- **Three-Column Layout**: Update `.main-layout` to accommodate three columns:
  1. `board-column` (Flex-grow, contains the chessboard)
  2. `history-column` (Fixed width ~250px, contains move history)
  3. `sidebar-column` (Fixed width ~300px, contains existing tabs/settings)
- **Responsive Behavior**: On smaller screens, the layout will wrap naturally (Board -> History -> Controls) due to flexbox wrapping.

## Component Design
### Move History Container
- A vertical panel with a distinct background (e.g., matching the sidebar).
- Contains a header (e.g., "История ходов").
- Contains a scrollable `div` (`overflow-y: auto`) for the actual moves.
- Height should roughly match the board.

### Move List Formatting
- Moves are retrieved using `game.history()`.
- Displayed in a grid or flex format:
  `[Turn Number] [White Move] [Black Move]`
- Example: 
  `1. e4 e5`
  `2. Nf3 Nc6`
- The most recent move should be highlighted.
- Auto-scroll to bottom: Whenever a new move is added, the scrollable container should smoothly scroll to its `scrollHeight`.

## Implementation Details
1. **HTML Updates**:
   - Insert `<div class="history-column">` inside `.main-layout` between the board and the sidebar.
2. **CSS Updates**:
   - Add styles for `.history-column`, `.move-list`, `.move-row`, `.move-number`, `.move-text`.
   - Ensure the main layout max-width is expanded (e.g., `max-width: 1400px;`) to comfortably fit 3 columns on large screens.
3. **JS Updates**:
   - Create `updateMoveHistory()` function.
   - Call `updateMoveHistory()` at the end of `updateStatus()`.
   - Logic: Iterate through `game.history()` array. Every 2 moves form one row.
   - Clear and rebuild the DOM elements for the history list.

## Future Proofing
- Each move element (`.move-text`) should be wrapped in a `span` or `button` to easily support click events for the upcoming "Move Navigation" feature.
