# Move Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement UI controls and clickable history to navigate through past game states without permanently undoing moves unless a new branch is created.

**Architecture:** We will maintain a global `historyFENs` array and a `currentViewPly` index. We will add a button row to the HTML under the move history list. JS handlers will update the board position based on the index, and `onDragStart` will automatically truncate the game if the user initiates a move while viewing the past.

**Tech Stack:** HTML5, CSS3, jQuery, chess.js.

---

### Task 1: Update HTML & CSS

**Files:**
- Modify: `/Users/eugene/Downloads/chess/index.html`
- Modify: `/Users/eugene/Downloads/chess/style.css`

- [ ] **Step 1: Add Navigation Buttons to HTML**

Run: Use `replace_file_content` on `index.html`.
Find:
```html
        <div class="history-column" style="flex: 0 0 250px; background-color: var(--panel-bg); border-radius: 8px; box-shadow: var(--shadow); display: flex; flex-direction: column; height: 500px; padding-bottom: 10px;">
            <h3 style="margin: 0; padding: 15px; border-bottom: 1px solid var(--border-color); font-size: 16px; text-align: center;">История ходов</h3>
            <div id="moveHistoryList" style="flex: 1; overflow-y: auto; padding: 10px; font-family: monospace; font-size: 14px; display: flex; flex-direction: column; gap: 4px;">
                <!-- Сюда будут добавляться ходы -->
            </div>
        </div>
```
Replace with:
```html
        <div class="history-column" style="flex: 0 0 250px; background-color: var(--panel-bg); border-radius: 8px; box-shadow: var(--shadow); display: flex; flex-direction: column; height: 500px; padding-bottom: 10px;">
            <h3 style="margin: 0; padding: 15px; border-bottom: 1px solid var(--border-color); font-size: 16px; text-align: center;">История ходов</h3>
            <div id="moveHistoryList" style="flex: 1; overflow-y: auto; padding: 10px; font-family: monospace; font-size: 14px; display: flex; flex-direction: column; gap: 4px;">
                <!-- Сюда будут добавляться ходы -->
            </div>
            <div style="display: flex; gap: 5px; padding: 0 10px; justify-content: center; margin-top: 10px;">
                <button id="navFirstBtn" class="nav-btn">|◀</button>
                <button id="navPrevBtn" class="nav-btn">◀</button>
                <button id="navNextBtn" class="nav-btn">▶</button>
                <button id="navLastBtn" class="nav-btn">▶|</button>
            </div>
        </div>
```

- [ ] **Step 2: Add CSS for Nav Buttons and Active Move**

Run: Shell command to append to `style.css`.
```bash
cat << 'EOF' >> /Users/eugene/Downloads/chess/style.css

/* Navigation Buttons */
.nav-btn {
  flex: 1;
  padding: 8px 0;
  background-color: var(--border-color);
  color: var(--text-color);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.nav-btn:hover {
  background-color: var(--accent-color);
  color: white;
}

/* Active Move Highlight */
.move-text.active-move {
  background-color: var(--accent-color);
  color: white;
  font-weight: bold;
}
EOF
```

### Task 2: Implement JS Navigation Logic

**Files:**
- Modify: `/Users/eugene/Downloads/chess/script.js`

- [ ] **Step 1: Declare State Variables**

Insert global variables near the top of the file.
Find:
```javascript
    var game = new Chess();
```
Replace with:
```javascript
    var game = new Chess();
    var historyFENs = [game.fen()];
    var currentViewPly = 0;
```

- [ ] **Step 2: Implement goToPly function**

Insert `goToPly` function right after `updateMoveHistory` function ends.
Find:
```javascript
        // Автоматическая прокрутка вниз
        listEl.scrollTop(listEl[0].scrollHeight);
    }
```
Replace with:
```javascript
        // Обновляем подсветку активного хода
        $('.move-text').removeClass('active-move');
        if (currentViewPly > 0) {
            $('.move-text[data-ply="' + (currentViewPly - 1) + '"]').addClass('active-move');
        }

        // Автоматическая прокрутка вниз
        listEl.scrollTop(listEl[0].scrollHeight);
    }

    function goToPly(ply) {
        if (ply < 0) ply = 0;
        if (ply >= historyFENs.length) ply = historyFENs.length - 1;
        
        currentViewPly = ply;
        board.position(historyFENs[ply]);
        clearArrows();
        
        $('.move-text').removeClass('active-move');
        if (currentViewPly > 0) {
            $('.move-text[data-ply="' + (currentViewPly - 1) + '"]').addClass('active-move');
        }
    }
```

- [ ] **Step 3: Track FENs on Player Move**

Update `historyFENs` and `currentViewPly` in `onDrop`.
Find:
```javascript
        // Ход не по правилам
        if (move === null) return 'snapback';
        
        playSoundForMove(move);
```
Replace with:
```javascript
        // Ход не по правилам
        if (move === null) return 'snapback';
        
        historyFENs.push(game.fen());
        currentViewPly = historyFENs.length - 1;
        
        playSoundForMove(move);
```

- [ ] **Step 4: Track FENs on Bot Move**

Update tracking in `stockfish.onmessage`.
Find:
```javascript
                    var botMove = game.move({
                        from: from,
                        to: to,
                        promotion: promotion
                    });
                    
                    playSoundForMove(botMove);
```
Replace with:
```javascript
                    var botMove = game.move({
                        from: from,
                        to: to,
                        promotion: promotion
                    });
                    
                    historyFENs.push(game.fen());
                    currentViewPly = historyFENs.length - 1;
                    
                    playSoundForMove(botMove);
```

### Task 3: Handle Truncation and Resets

**Files:**
- Modify: `/Users/eugene/Downloads/chess/script.js`

- [ ] **Step 1: Implement Truncation in `onDragStart`**

When dragging starts, if viewing history, truncate everything after `currentViewPly`.
Find:
```javascript
    function onDragStart(source, piece, position, orientation) {
        if (isBotThinking) return false;
        clearArrows();
```
Replace with:
```javascript
    function onDragStart(source, piece, position, orientation) {
        if (isBotThinking) return false;
        clearArrows();

        // Branching logic: if we are viewing the past and start moving, truncate the future
        if (currentViewPly < historyFENs.length - 1) {
            while (historyFENs.length - 1 > currentViewPly) {
                game.undo();
                historyFENs.pop();
            }
            updateMoveHistory();
            updateStatus();
        }
```

- [ ] **Step 2: Connect Navigation Listeners**

Add listeners for the new UI buttons and clickable moves at the end of the file.
Find:
```javascript
    // Делаем доску адаптивной
```
Replace with:
```javascript
    // --- Навигация по истории ---
    $('#navFirstBtn').on('click', function() { goToPly(0); });
    $('#navPrevBtn').on('click', function() { goToPly(currentViewPly - 1); });
    $('#navNextBtn').on('click', function() { goToPly(currentViewPly + 1); });
    $('#navLastBtn').on('click', function() { goToPly(historyFENs.length - 1); });

    $('#moveHistoryList').on('click', '.move-text', function() {
        var ply = parseInt($(this).data('ply'), 10);
        goToPly(ply + 1);
    });

    // Делаем доску адаптивной
```

- [ ] **Step 3: Reset State on New Game**

Reset the state variables in `startPositionBtn` and `clearBoardBtn` handlers.
Find:
```javascript
    $('#startPositionBtn').on('click', function() {
        clearArrows();
        currentHints = {};
        board.start();
```
Replace with:
```javascript
    $('#startPositionBtn').on('click', function() {
        clearArrows();
        currentHints = {};
        board.start();
        game.reset();
        historyFENs = [game.fen()];
        currentViewPly = 0;
        playSound('gameStart');
        updateStatus();
    });

    $('#clearBoardBtn').on('click', function() {
        clearArrows();
        currentHints = {};
        board.clear();
        game.clear();
        historyFENs = [game.fen()];
        currentViewPly = 0;
        playSound('gameStart');
        updateStatus();
    });
```
*(Ensure `replace_file_content` matches the existing button handlers precisely. The existing handlers already have `game.reset();` and `playSound('gameStart');`)*

### Task 4: Verification

- [ ] **Step 1: Test Navigation (Manual)**

Instruct the user to play 5 moves, use buttons to browse backward and forward, click a move in the history list, and attempt a branching move from the past.
