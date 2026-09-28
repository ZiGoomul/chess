# Eval Bar Design Spec

## Overview
Add a vertical evaluation bar (Eval Bar) to the left of the chessboard. It visually represents the current engine advantage (from `hintStockfish`) and includes the numeric score. Satisfies item #3 on the roadmap.

## Architecture
- **Data Source**: We intercept the `info depth X score cp Y` or `score mate Z` messages from the `hintStockfish.onmessage` handler.
- **Score Calculation**: 
  - Centipawns (cp) are converted to pawns (divide by 100).
  - Mate scores (`score mate Z`) are treated as extreme advantage and display text like `M3` or `-M2`.
  - The white bar percentage is calculated using a clamped linear mapping: `50 + (cp / 15)` clamped between 5% and 95%. Mate is 0% or 100%.

## UI Layout
- Create a wrapper `<div style="display: flex; flex-direction: row; align-items: stretch; gap: 10px;">` around the `#myBoard` and its overlay.
- Insert `<div id="evalBarContainer">` as the first child of the wrapper (to the left of the board).
- Dimensions: `width: 25px; border-radius: 4px; overflow: hidden; position: relative; background-color: #303030;`
- White bar child: `<div id="evalBarWhite" style="position: absolute; bottom: 0; width: 100%; height: 50%; background-color: #eaeaea; transition: height 0.3s ease-out;"></div>`
- Text child: `<div id="evalBarText" style="position: absolute; width: 100%; text-align: center; font-size: 11px; font-weight: bold; color: #888; z-index: 2; top: 10px;">0.0</div>`

## Implementation Details
1. **HTML Modification**: Restructure `index.html` to wrap the board and overlay, adding the Eval Bar.
2. **JS Modification**:
   - Add `updateEvalBar(cp, mate)` function.
   - Modify `hintStockfish.onmessage` to parse `cp` or `mate` from intermediate `info` lines.
   - Note: We only update the eval bar if `pv` (principal variation) is 1 or if we just want the highest depth score.
   - Handle board flipping: If the board is flipped (black at bottom), the eval bar should visually flip too (black at bottom, white at top). We'll add a check for `board.orientation()`.
