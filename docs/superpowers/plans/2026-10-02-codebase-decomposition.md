# Codebase Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the monolithic 1500-line `game-controller.js` and 1180-line `style.css` into an Event-Driven Store architecture without breaking any functionality.

**Architecture:** A central `EventBus` and `GameStore` handle communication. UI is split into independent `*View` components (`BoardView`, `ShellView`, etc.) that listen to store/bus events. Logic is split into `*Coordinator` services. CSS is split into functional modules.

**Tech Stack:** JavaScript (ES Modules), jQuery, Chess.js, Chessboard.js, Node.js (`tsx --test`), Vite.

---

### Task 1: CSS Modularization

**Files:**
- Create: `styles/base.css`, `styles/components.css`, `styles/board.css`, `styles/review.css`, `styles/time-control.css`
- Modify: `style.css`

- [ ] **Step 1: Create the styles directory**
```bash
mkdir -p styles
```

- [ ] **Step 2: Split CSS files by section**
Use `view_file` to read `style.css` and `write_to_file` to create the module files, moving the exact lines from `style.css` to the new files based on comments:
- `styles/base.css`: Base variables, resets, tabs up to line 125.
- `styles/board.css`: Board styles, capture rings, square colors (lines 126 to 299).
- `styles/components.css`: Toggles, form controls.
- `styles/review.css`: Move history, review components (lines 300 to 880).
- `styles/time-control.css`: Modal, preset grid, custom time (lines 881 to end).

- [ ] **Step 3: Update `style.css` to be an entry point**
```css
@import './styles/base.css';
@import './styles/components.css';
@import './styles/board.css';
@import './styles/review.css';
@import './styles/time-control.css';
```

- [ ] **Step 4: Verify build**
Run: `npm run build`
Expected: Passes and builds correctly.

- [ ] **Step 5: Commit**
```bash
git add style.css styles/
git commit -m "refactor(css): modularize style.css"
```

### Task 2: EventBus Implementation

**Files:**
- Create: `src/core/event-bus.js`
- Create: `tests/event-bus.test.js`

- [ ] **Step 1: Write the failing test**
```javascript
// tests/event-bus.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { createEventBus } from '../src/core/event-bus.js';

test('EventBus allows publish and subscribe', () => {
    const bus = createEventBus();
    let received = null;
    bus.on('test:event', (payload) => { received = payload; });
    bus.emit('test:event', { data: 123 });
    assert.deepStrictEqual(received, { data: 123 });
});

test('EventBus allows unsubscribe', () => {
    const bus = createEventBus();
    let count = 0;
    const handler = () => count++;
    bus.on('test:event', handler);
    bus.off('test:event', handler);
    bus.emit('test:event');
    assert.strictEqual(count, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test tests/event-bus.test.js`
Expected: FAIL with "Cannot find module" or "createEventBus is not defined"

- [ ] **Step 3: Write minimal implementation**
```javascript
// src/core/event-bus.js
export function createEventBus() {
    const listeners = new Map();
    return {
        on(event, handler) {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event).add(handler);
        },
        off(event, handler) {
            if (listeners.has(event)) listeners.get(event).delete(handler);
        },
        emit(event, payload) {
            if (listeners.has(event)) {
                listeners.get(event).forEach(handler => handler(payload));
            }
        },
        clear() {
            listeners.clear();
        }
    };
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test tests/event-bus.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add tests/event-bus.test.js src/core/event-bus.js
git commit -m "feat(core): implement EventBus"
```

### Task 3: GameStore Implementation

**Files:**
- Create: `src/core/game-store.js`
- Create: `tests/game-store.test.js`

- [ ] **Step 1: Write the failing test**
```javascript
// tests/game-store.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { createGameStore } from '../src/core/game-store.js';
import { Chess } from 'chess.js';

test('GameStore initializes with default state and allows subscription', () => {
    const store = createGameStore();
    const state = store.getState();
    assert.strictEqual(state.mode, 'free');
    assert.strictEqual(state.historyFENs.length, 1);
    
    let notified = false;
    store.subscribe(() => { notified = true; });
    store.setState({ mode: 'bot' });
    
    assert.strictEqual(notified, true);
    assert.strictEqual(store.getState().mode, 'bot');
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test tests/game-store.test.js`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
```javascript
// src/core/game-store.js
import { Chess } from 'chess.js';

export function createGameStore(initialState = {}) {
    let state = {
        game: new Chess(),
        historyFENs: [new Chess().fen()],
        currentViewPly: 0,
        selectedSquare: null,
        mode: 'free', // 'free' | 'bot' | 'puzzle'
        orientation: 'white',
        isThinking: false,
        settings: {
            highlightMoves: true,
            highlightAttacks: false,
            highlightDefenses: false,
            autoHint: false,
            botLevel: 10
        },
        eval: { cp: null, mate: null },
        ...initialState
    };
    
    const listeners = new Set();
    
    return {
        getState() {
            return state;
        },
        setState(partial) {
            state = { ...state, ...partial };
            listeners.forEach(listener => listener(state));
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test tests/game-store.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add tests/game-store.test.js src/core/game-store.js
git commit -m "feat(core): implement GameStore"
```

### Task 4: View Extraction (EvalBar & Material)

**Files:**
- Create: `src/ui/eval-bar-view.js`
- Create: `src/ui/material-view.js`

- [ ] **Step 1: Extract EvalBarView**
Extract the `updateEvalBar` function from `game-controller.js` into `src/ui/eval-bar-view.js`. Make it a factory `createEvalBarView({ $, eventBus })` that listens to `engine:eval-updated` and `board:orientation-changed`.

- [ ] **Step 2: Extract MaterialView**
Extract `updateMaterial` and `getPieceThemeUrl` from `game-controller.js` into `src/ui/material-view.js`. Make it a factory `createMaterialView({ $, eventBus })` that listens to `game:move-made`, `game:ply-changed`, `board:orientation-changed`.

- [ ] **Step 3: Commit**
```bash
git add src/ui/eval-bar-view.js src/ui/material-view.js
git commit -m "refactor(ui): extract EvalBarView and MaterialView"
```

### Task 5: Services Extraction (Bot & Analysis)

**Files:**
- Create: `src/services/bot-coordinator.js`
- Create: `src/services/analysis-coordinator.js`

- [ ] **Step 1: Extract BotCoordinator**
Move `makeBotMove`, `cancelBotSearch`, `updateStockfishLevel` into `createBotCoordinator({ eventBus, store, engineWorker })`.

- [ ] **Step 2: Extract AnalysisCoordinator**
Move `autoHintIfNeeded`, `requestHint`, `drawHintArrows` into `createAnalysisCoordinator({ eventBus, store, engineWorker })`.

- [ ] **Step 3: Commit**
```bash
git add src/services/bot-coordinator.js src/services/analysis-coordinator.js
git commit -m "refactor(services): extract Bot and Analysis coordinators"
```

### Task 6: View Extraction (BoardView & ShellView)

**Files:**
- Create: `src/ui/board-view.js`
- Create: `src/ui/shell-view.js`

- [ ] **Step 1: Extract BoardView**
Move all Chessboard.js initialization, `onDragStart`, `onDrop`, `onSnapEnd`, square click handlers (`getSquareAtPoint`, `handleSquareClick`), highlights (`showMoveHints`, `removeHighlights`, `highlightCheck`), and SVG arrow drawing (`drawArrow`, `clearArrows`) into `createBoardView({ $, eventBus, store })`.

- [ ] **Step 2: Extract ShellView**
Move all `.tab-btn` click listeners, theme switchers, `#timeControlDialog` handlers, and FEN import/export modal logic into `createShellView({ $, eventBus, store })`.

- [ ] **Step 3: Commit**
```bash
git add src/ui/board-view.js src/ui/shell-view.js
git commit -m "refactor(ui): extract BoardView and ShellView"
```

### Task 7: GameOrchestrator Assembly

**Files:**
- Create: `src/app/game-orchestrator.js`
- Modify: `src/main.js`
- Modify: `src/app/game-controller.js` (Delete)

- [ ] **Step 1: Assemble the Orchestrator**
Create `src/app/game-orchestrator.js` replacing `game-controller.js`. It initializes `EventBus`, `GameStore`, creates instances of all the Views and Services, and glues the business logic (e.g. `eventBus.on('board:move-attempted', (payload) => { ... store.getState().game.move(...) })`).

- [ ] **Step 2: Update entrypoint**
Change `src/main.js` to import `game-orchestrator.js` instead of `game-controller.js`. Delete `game-controller.js`.

- [ ] **Step 3: Verify tests and build**
Run: `npm test && npm run typecheck && npm run build`
Verify all 40 tests pass.

- [ ] **Step 4: Commit**
```bash
git rm src/app/game-controller.js
git add src/main.js src/app/game-orchestrator.js
git commit -m "refactor(app): replace monolithic controller with game-orchestrator"
```
