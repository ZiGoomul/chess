# Interactive Key Moments Practice (Mistake Trainer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow players to interactively practice and correct their critical mistakes during post-game review, with multi-level hints and opponent refutation demonstrations.

**Architecture:** Create a `ReviewTrainerController` plugged into the existing `guided` adapter in `game-orchestrator.js` alongside puzzles and lessons. Enrich `findCriticalMoments` with opponent refutation data from `evaluations[ply + 1]`. Update `post-game-review.js` and `index.html` with a dedicated trainer card providing interactive hints, solution reveals, and refutation demonstrations.

**Tech Stack:** JavaScript (ES modules), jQuery, chess.js, Node.js test runner (`tsx --test`).

---

### Task 1: Enrich Critical Moments with Refutations

**Files:**
- Modify: `src/services/game-review.js:42-68`
- Test: `tests/game-review.test.js`

- [ ] **Step 1: Write failing test in `tests/game-review.test.js`**

Add a test verifying that `findCriticalMoments` includes `refutationMove` from the subsequent evaluation (`evaluations[index + 1]?.evaluation?.pv`) and calculates `refutationSan`:

```javascript
test('findCriticalMoments captures opponent refutation move from next evaluation', () => {
  const fens = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 2',
    'rnbqkbnr/pppp1ppp/8/4p3/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 2'
  ];
  const moves = [{ san: 'e5' }, { san: 'Nf3' }];
  const evaluations = [
    { evaluation: { type: 'cp', value: 20, pv: 'g8f6' } },
    { evaluation: { type: 'cp', value: -250, pv: 'd2d4' } },
    { evaluation: { type: 'cp', value: 250, pv: 'b8c6' } }
  ];
  const moments = findCriticalMoments({
    record: { fens, moves, humanColor: 'b' },
    evaluations,
    thresholdCp: 80
  });

  assert.equal(moments.length, 1);
  assert.equal(moments[0].bestMove, 'g8f6');
  assert.equal(moments[0].refutationMove, 'd2d4');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/game-review.test.js`
Expected: FAIL with `assert.equal(moments[0].refutationMove, 'd2d4')` undefined.

- [ ] **Step 3: Implement refutation capture in `src/services/game-review.js`**

In `findCriticalMoments` in `src/services/game-review.js`:
```javascript
    const nextEval = evaluations[index + 1]?.evaluation;
    moments.push({
      ply: index,
      san: moves[index].san || null,
      lossCp,
      beforeCp: beforeScore,
      afterCp: afterScore,
      bestMove: before.pv,
      refutationMove: nextEval?.pv || null,
      motif: classifySupportedMotif({ before, after })
    });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/game-review.test.js`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/services/game-review.js tests/game-review.test.js
git commit -m "feat(review): capture opponent refutation move in critical moments"
```

---

### Task 2: Create Review Trainer Controller

**Files:**
- Create: `src/app/review-trainer-controller.js`
- Test: `tests/review-trainer-controller.test.js`
- Modify: `tests/helpers/harness.js` (add trainer DOM elements & fake methods)

- [ ] **Step 1: Update `tests/helpers/harness.js` with trainer elements and boardView methods**

Add `#reviewTrainerCard`, `#reviewTrainerPosition`, `#reviewTrainerPrompt`, `#reviewTrainerHintBtn`, `#reviewTrainerRefutationBtn`, `#reviewTrainerNextBtn`, `#reviewTrainerExitBtn`, `#reviewStartPracticeBtn` to `PAGE` template in `tests/helpers/harness.js`, and ensure `createFakeBoardView` has `drawArrow(from, to, tone)`, `highlightSquares(squares)`, `clearHighlights()`.

- [ ] **Step 2: Write failing unit tests in `tests/review-trainer-controller.test.js`**

Cover:
1. `start()` enters active mode, loads initial moment position, and shows prompt.
2. `tryMove()` with incorrect move: returns false, plays wrong feedback, increments attempts.
3. `tryMove()` with correct move: returns true, updates board/store, plays correct feedback, marks moment solved.
4. `requestHint()`: Level 1 highlights piece square; Level 2 draws arrow; Level 3 reveals solution.
5. `showRefutation()` and `hideRefutation()`: animates played move + refutation and resets.
6. `nextMoment()` advances to next moment; completing all moments finishes session.
7. `exit()` cleans up state, removes arrows/highlights, restores store.

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test tests/review-trainer-controller.test.js`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `createReviewTrainerController` in `src/app/review-trainer-controller.js`**

Implement `createReviewTrainerController({ $, Chess, store, eventBus, boardView, moveHistoryView, playSound, playSoundForMove, toSan, onComplete })`:
- State: `active`, `record`, `moments`, `currentIndex`, `hintLevel`, `attempts`, `solvedCount`, `firstTryCount`, `isCompleted`.
- Methods: `isActive()`, `isCompleted()`, `start(record, moments, startIndex)`, `tryMove(source, target, promotion)`, `requestHint()`, `showRefutation()`, `hideRefutation()`, `nextMoment()`, `prevMoment()`, `exit(options)`.
- Helper to convert UCI `bestMove` (e.g. `g1f3`) to SAN for feedback.
- Highlight piece square using `boardView.highlightSquares([from])` or `boardView.showSquareFeedback`.
- Draw arrow for best move using `eventBus.emit('engine:hints-updated', ...)`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test tests/review-trainer-controller.test.js`
Expected: PASS.

- [ ] **Step 6: Commit changes**

```bash
git add src/app/review-trainer-controller.js tests/review-trainer-controller.test.js tests/helpers/harness.js
git commit -m "feat(review): implement review trainer controller with hints and refutations"
```

---

### Task 3: Post-Game Review UI & HTML/CSS Updates

**Files:**
- Modify: `index.html:450-475`
- Modify: `styles/review.css`
- Modify: `src/ui/post-game-review.js`
- Test: `tests/post-game-review-view.test.js`

- [ ] **Step 1: Write failing UI tests in `tests/post-game-review-view.test.js`**

Test that:
1. When report has moments, `#reviewStartPracticeBtn` is visible with count of moments.
2. Clicking `#reviewStartPracticeBtn` triggers `onStartPractice(record, moments)`.
3. Selecting a moment shows `#reviewPracticeMomentBtn` («Исправить этот момент»).
4. `showPracticeCard()` hides the moments list and reveals the practice card.
5. `hidePracticeCard()` restores the moments list.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/post-game-review-view.test.js`
Expected: FAIL.

- [ ] **Step 3: Update `index.html` and `styles/review.css`**

Add in `index.html`:
- `#reviewStartPracticeBtn` in `.review-actions` or right above `#reviewMoments`.
- `#reviewPracticeMomentBtn` in `.review-actions`.
- `#reviewTrainerCard` containing `#reviewTrainerNav`, `#reviewTrainerPrompt`, `#reviewTrainerActions` (`#reviewTrainerHintBtn`, `#reviewTrainerRefutationBtn`, `#reviewTrainerNextBtn`, `#reviewTrainerExitBtn`).
Style `#reviewTrainerCard` in `styles/review.css` with clean layout, badges, and responsive buttons.

- [ ] **Step 4: Update `src/ui/post-game-review.js`**

Add `onStartPractice` and `onPracticeMoment` callbacks to `createPostGameReviewView`. Wire up `#reviewStartPracticeBtn` and `#reviewPracticeMomentBtn`. Provide `showPracticeCard` and `hidePracticeCard` UI helper methods on the returned view.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test tests/post-game-review-view.test.js`
Expected: PASS.

- [ ] **Step 6: Commit changes**

```bash
git add index.html styles/review.css src/ui/post-game-review.js tests/post-game-review-view.test.js
git commit -m "feat(review): add practice card and start practice controls to review view"
```

---

### Task 4: Integrate Review Trainer with Orchestrator & Guided Mode

**Files:**
- Modify: `src/app/game-orchestrator.js:155-275`
- Test: `tests/game-session.test.js`

- [ ] **Step 1: Write integration test in `tests/game-session.test.js`**

Test that when `reviewTrainer` is active:
1. `guided.isActive()` returns true.
2. `session.makeMove` routes to `reviewTrainer.tryMove`.
3. Moving to another tab (e.g. editor, puzzles) exits the review trainer.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/game-session.test.js`
Expected: FAIL.

- [ ] **Step 3: Wire `createReviewTrainerController` in `src/app/game-orchestrator.js`**

1. Instantiate `createReviewTrainerController` passing store, eventBus, boardView, moveHistoryView, playSound, etc.
2. Update `guided` object in `game-orchestrator.js`:
```javascript
const guided = {
    isActive: () => puzzle.isActive() || lesson.isActive() || trainer.isActive(),
    isCompleted: () => (trainer.isActive() ? trainer.isCompleted() : (lesson.isActive() ? lesson.isCompleted() : puzzle.isCompleted())),
    tryMove: (source, target, promotion) => {
        if (trainer.isActive()) return trainer.tryMove(source, target, promotion);
        return lesson.isActive() ? lesson.tryMove(source, target, promotion) : puzzle.tryMove(source, target, promotion);
    },
    exit: (options) => {
        if (trainer.isActive()) trainer.exit(options);
        if (lesson.isActive()) lesson.exit(options);
        if (puzzle.isActive()) puzzle.exit(options);
    }
};
```
3. Connect `onStartPractice: (record, moments) => trainer.start(record, moments)` and `onPracticeMoment: (record, moment) => trainer.start(record, moments, index)` from `reviewView`.
4. Ensure tab switches (`tab-setup`, `tab-puzzles`, etc.) call `guided.exit({ keepPosition: true })`.

- [ ] **Step 4: Run all tests to verify everything passes**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 5: Run linter and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add src/app/game-orchestrator.js tests/game-session.test.js
git commit -m "feat(review): integrate review trainer with guided mode and game session"
```
