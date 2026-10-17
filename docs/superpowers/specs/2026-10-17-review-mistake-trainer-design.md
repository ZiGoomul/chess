# Interactive Key Moments Practice (Mistake Trainer) Design

## Status

Draft for user review. This document specifies the design for the interactive "Learn from your mistakes" practice mode during post-game review.

## Goal

Provide an interactive training mode for critical moments ("Ключевые моменты") identified during post-game review. Instead of only reviewing mistakes passively or continuing the game against the bot, the player can actively practice finding the best moves with step-by-step hints and inspect why their actual move was a mistake (refutation).

## User Workflow

1. **Entry Point:**
   - After a game review finishes and identifies critical moments, the review panel displays a prominent action button: **«Работа над ошибками (N)»**, where *N* is the count of critical moments.
   - Alternatively, selecting any moment card in the review list provides an **«Исправить»** button alongside the existing options.

2. **Practice Session:**
   - Entering practice mode switches the review panel into a focused trainer card and sets the board to the position immediately before the first critical move.
   - Board orientation automatically matches the player's side (`humanColor`).
   - The trainer card displays:
     - Progress counter: *«Момент 1 из N»* with a close/exit button (`✕`).
     - Coach message: *«Ход {цвета}. В партии вы сыграли {ход} ({оценка упала на X}). Найдите лучший ход!»*

3. **Interactive Solving:**
   - The user attempts moves on the board.
   - **Correct Move (matches engine `bestMove`):**
     - Plays move sound and success audio tone.
     - Displays positive feedback: *«Отлично! {Ход} — лучший ход! 🎉»*.
     - Enables the **«Следующий момент»** button.
     - Tracks the moment as solved (recorded whether solved with or without hints).
   - **Suboptimal Move:**
     - The piece snaps back (move rejected).
     - Plays invalid/mistake sound.
     - Displays encouragement: *«Ход {ход} не решает проблему. Попробуйте еще раз!»*.
     - Increments the mistake attempt counter for this moment.

4. **Multi-level Hints (Button «💡 Подсказка»):**
   - **Step 1 (Idea & Square Highlight):** Explanatory hint text (e.g. *«Обратите внимание на {фигуру} на поле {клетка}»*) and highlights the piece's square on the board.
   - **Step 2 (Arrow):** Draws an arrow on the board from the source square to the target square.
   - **Step 3 (Solution):** Button changes to **«Показать решение»**. Clicking it automatically plays the best move on the board, advances the trainer state to solved, and unlocks **«Следующий момент»**.

5. **Refutation Demonstration (Button «❓ Почему ход в партии — ошибка?»):**
   - Explains why the move played in the game was a blunder/mistake:
     - If the subsequent engine evaluation (`evaluations[ply + 1].evaluation.pv`) contains the opponent's best reply:
       - The board temporarily animates the played move followed by the opponent's refutation move.
       - A banner explains the refutation (e.g. *«В партии после 14… e5 соперник ответил 15. Nxd5! с выигрышем материала»*).
       - A **«Вернуться к попытке»** button resets the board back to the puzzle position so the user can continue solving.
     - If no refutation move is available (game ended or mate allowed):
       - Displays the tactical reason directly (e.g. *«Ход допускает форсированный мат»* or *«Потеря материала без компенсации»*).

6. **Session Completion:**
   - After the final moment is solved or revealed, the trainer card shows a summary screen:
     - *«Все ключевые моменты пройдены! Без подсказок решено: M из N»*.
     - Button **«Вернуться к разбору»**, which restores the regular review list and board view.

## Architecture and Components

### 1. `ReviewTrainerController` (`src/app/review-trainer-controller.js`)
Dedicated domain/application controller for mistake practice sessions:
- Maintains internal state:
  - `active`: boolean
  - `record`: game record (FENs, moves, humanColor)
  - `moments`: array of critical moment objects `{ ply, san, lossCp, beforeCp, afterCp, bestMove, motif, refutationMove }`
  - `currentIndex`: current moment index (0 .. moments.length - 1)
  - `hintLevel`: 0 (none) -> 1 (piece square) -> 2 (move arrow) -> 3 (reveal)
  - `attempts`: number of tries on the current moment
  - `solvedStats`: counts of unassisted vs assisted solves
  - `isRefutationShown`: boolean
- Exposes standard guided mode interface:
  - `isActive(): boolean`
  - `isCompleted(): boolean`
  - `tryMove(source, target, promotion): boolean`
  - `start(record, moments, startIndex = 0)`
  - `exit(options)`
  - `nextMoment()`
  - `prevMoment()`
  - `requestHint()`
  - `showRefutation()`
  - `hideRefutation()`

### 2. Integration with `guided` in `src/app/game-orchestrator.js`
The central `guided` adapter coordinates scripted moves across puzzles, opening lessons, and review trainer:
```javascript
const guided = {
    isActive: () => puzzle.isActive() || lesson.isActive() || reviewTrainer.isActive(),
    isCompleted: () => {
        if (reviewTrainer.isActive()) return reviewTrainer.isCompleted();
        return lesson.isActive() ? lesson.isCompleted() : puzzle.isCompleted();
    },
    tryMove: (source, target, promotion) => {
        if (reviewTrainer.isActive()) return reviewTrainer.tryMove(source, target, promotion);
        return lesson.isActive()
            ? lesson.tryMove(source, target, promotion)
            : puzzle.tryMove(source, target, promotion);
    },
    exit: (options) => {
        if (reviewTrainer.isActive()) reviewTrainer.exit(options);
        if (lesson.isActive()) lesson.exit(options);
        if (puzzle.isActive()) puzzle.exit(options);
    }
};
```

### 3. Review moments data enrichment (`src/services/game-review.js`)
When constructing moments in `findCriticalMoments({ record, evaluations })`:
- Store `refutationMove`: `evaluations[index + 1]?.evaluation?.pv || null`
- Store `refutationSan`: SAN equivalent of `refutationMove` from position `record.fens[index + 1]` if available.

### 4. UI View (`src/ui/post-game-review.js`)
- Adds `#reviewStartPracticeBtn` to the review summary/actions.
- Renders an interactive practice container `#reviewTrainerCard` with:
  - Header: position index, exit button
  - Status/prompt message
  - Hint button, Refutation button, Next button
- Toggles visibility between regular moments list `#reviewMoments` and `#reviewTrainerCard`.

## Edge Cases

1. **Promotion Moves:**
   - When `bestMove` contains promotion (e.g. `e7e8q`), player moves must match the target piece or trigger promotion selection.
2. **Tab Navigation / Interruptions:**
   - Navigating away to "Задачи", "Редактор", or starting a new game calls `guided.exit()`, properly restoring the board, clearing hints, and resetting active timeouts.
3. **Missing Opponent PV (Immediate Game End):**
   - If player's mistake led to immediate surrender or checkmate with no subsequent evaluation, `refutationMove` is null; the refutation view displays textual motif description without hanging.
4. **No Critical Moments:**
   - When a game has no blunders/mistakes, the practice button is hidden.

## Testing Plan

1. **Unit Tests (`tests/review-trainer-controller.test.js`):**
   - Test starting practice with moments array.
   - Test `tryMove`: correct move returns true, incorrect move returns false and increments attempts.
   - Test hint progression: level 1 highlights square, level 2 draws arrow, level 3 provides reveal action.
   - Test refutation display and reset to original moment position.
   - Test navigation across moments and session completion.
   - Test graceful `exit()`.
2. **UI & Integration Tests (`tests/post-game-review-view.test.js`):**
   - Verify practice button appears when moments are present.
   - Verify clicking practice button starts trainer and updates DOM.
