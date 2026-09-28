# Puzzles Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a fully functional "Puzzles" mode with a dedicated UI tab, a local database of chess puzzles, and custom validation logic for drag-and-drop moves.

**Architecture:** Add a new tab to the HTML. In JS, define `puzzleDatabase` array. In `onDrop`, branch logic based on `isPuzzleMode` boolean. Validate moves against `currentPuzzle.moves[currentPuzzleStep]` using SAN strings.

**Tech Stack:** HTML5, CSS3, jQuery, chess.js.

---

### Task 1: Update HTML UI

**Files:**
- Modify: `/Users/eugene/Downloads/chess/index.html`

- [ ] **Step 1: Add Puzzles Tab Button**

Run: Use `replace_file_content` on `index.html`.
Find:
```html
            <div class="tabs-header" style="display: flex; border-bottom: 1px solid var(--border-color); margin-bottom: 20px;">
                <button class="tab-btn active" data-tab="tab-play" style="flex: 1; background: none; color: var(--text-color); box-shadow: none; border-radius: 0; padding: 10px; border: none; border-bottom: 2px solid var(--accent-color); font-weight: bold;">Игра</button>
                <button class="tab-btn" data-tab="tab-setup" style="flex: 1; background: none; color: var(--text-color); box-shadow: none; border-radius: 0; padding: 10px; border: none; border-bottom: 2px solid transparent;">Редактор</button>
                <button class="tab-btn" data-tab="tab-style" style="flex: 1; background: none; color: var(--text-color); box-shadow: none; border-radius: 0; padding: 10px; border: none; border-bottom: 2px solid transparent;">Вид</button>
            </div>
```
Replace with:
```html
            <div class="tabs-header" style="display: flex; border-bottom: 1px solid var(--border-color); margin-bottom: 20px;">
                <button class="tab-btn active" data-tab="tab-play" style="flex: 1; background: none; color: var(--text-color); box-shadow: none; border-radius: 0; padding: 10px; border: none; border-bottom: 2px solid var(--accent-color); font-weight: bold;">Игра</button>
                <button class="tab-btn" data-tab="tab-puzzles" style="flex: 1; background: none; color: var(--text-color); box-shadow: none; border-radius: 0; padding: 10px; border: none; border-bottom: 2px solid transparent;">Задачи</button>
                <button class="tab-btn" data-tab="tab-setup" style="flex: 1; background: none; color: var(--text-color); box-shadow: none; border-radius: 0; padding: 10px; border: none; border-bottom: 2px solid transparent;">Редактор</button>
                <button class="tab-btn" data-tab="tab-style" style="flex: 1; background: none; color: var(--text-color); box-shadow: none; border-radius: 0; padding: 10px; border: none; border-bottom: 2px solid transparent;">Вид</button>
            </div>
```

- [ ] **Step 2: Add Puzzles Tab Content**

Run: Use `replace_file_content` on `index.html`.
Find:
```html
            <!-- TAB 1: Play -->
            <div class="tab-content" id="tab-play" style="display: flex; flex-direction: column; gap: 20px;">
```
Replace with:
```html
            <!-- TAB: Puzzles -->
            <div class="tab-content" id="tab-puzzles" style="display: none; flex-direction: column; gap: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0;">Решение задач</h3>
                    <span id="puzzlesScore" style="font-weight: bold; color: var(--accent-color);">Решено: 0</span>
                </div>
                
                <div style="background: rgba(0,0,0,0.1); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <div id="puzzleStatusText" style="font-size: 16px; font-weight: bold; margin-bottom: 10px; text-align: center;">Нажмите "Новая задача", чтобы начать!</div>
                    <div id="puzzleDescText" style="font-size: 14px; color: #888; text-align: center; min-height: 20px;"></div>
                </div>

                <button id="loadPuzzleBtn" style="padding: 12px; font-size: 16px; background-color: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Новая случайная задача</button>
                <button id="exitPuzzleBtn" style="padding: 10px; font-size: 14px; background-color: transparent; color: var(--text-color); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;">Выйти из режима задач</button>
            </div>

            <!-- TAB 1: Play -->
            <div class="tab-content" id="tab-play" style="display: flex; flex-direction: column; gap: 20px;">
```

### Task 2: Implement JS Logic

**Files:**
- Modify: `/Users/eugene/Downloads/chess/script.js`

- [ ] **Step 1: Declare Puzzle Data & Variables**

Find:
```javascript
    var currentViewPly = 0;
```
Replace with:
```javascript
    var currentViewPly = 0;

    // --- Режим задач ---
    var puzzleDatabase = [
        { fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5", moves: ["O-O"], desc: "Ход белых. Сделайте правильный ход в дебюте." },
        { fen: "6k1/1p3ppp/8/8/8/8/8/1R4K1 w - - 0 1", moves: ["Rb8#"], desc: "Ход белых. Мат в 1 ход." },
        { fen: "3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", moves: ["Rxd8#"], desc: "Ход белых. Мат в 1 ход." },
        { fen: "k7/P7/1K6/8/8/8/8/8 b - - 0 1", moves: ["Kb8"], desc: "Ход черных. Избегите пата?" } // Small trick puzzle
    ];
    var isPuzzleMode = false;
    var currentPuzzle = null;
    var currentPuzzleStep = 0;
    var solvedPuzzlesCount = 0;
```

- [ ] **Step 2: Add Puzzle Control Functions**

Add the logic for loading and managing puzzles. Add this before `function onDragStart`.
Find:
```javascript
    function onDragStart(source, piece, position, orientation) {
```
Replace with:
```javascript
    function loadRandomPuzzle() {
        var randIdx = Math.floor(Math.random() * puzzleDatabase.length);
        currentPuzzle = puzzleDatabase[randIdx];
        currentPuzzleStep = 0;
        isPuzzleMode = true;
        
        game.load(currentPuzzle.fen);
        board.position(game.fen());
        historyFENs = [game.fen()];
        currentViewPly = 0;
        
        // Поворачиваем доску нужной стороной
        if (game.turn() === 'w') {
            board.orientation('white');
        } else {
            board.orientation('black');
        }
        
        var moveColor = (game.turn() === 'w') ? 'Белые' : 'Черные';
        $('#puzzleStatusText').text('Ход: ' + moveColor + '. Ваш ход!');
        $('#puzzleStatusText').css('color', 'var(--text-color)');
        $('#puzzleDescText').text(currentPuzzle.desc);
        
        updateMoveHistory();
        clearArrows();
    }

    function exitPuzzleMode() {
        isPuzzleMode = false;
        currentPuzzle = null;
        $('#puzzleStatusText').text('Нажмите "Новая задача", чтобы начать!');
        $('#puzzleDescText').text('');
        $('#startPositionBtn').click(); // Возвращаемся в обычную игру
    }

    function playOpponentPuzzleMove() {
        if (!isPuzzleMode || currentPuzzleStep >= currentPuzzle.moves.length) return;
        
        var oppMoveSAN = currentPuzzle.moves[currentPuzzleStep];
        var moveObj = game.move(oppMoveSAN);
        board.position(game.fen());
        playSoundForMove(moveObj);
        historyFENs.push(game.fen());
        currentViewPly = historyFENs.length - 1;
        updateMoveHistory();
        
        currentPuzzleStep++;
        
        if (currentPuzzleStep >= currentPuzzle.moves.length) {
            puzzleCompleted();
        } else {
            $('#puzzleStatusText').text('Ваш ход!');
            $('#puzzleStatusText').css('color', 'var(--text-color)');
        }
    }

    function puzzleCompleted() {
        solvedPuzzlesCount++;
        $('#puzzlesScore').text('Решено: ' + solvedPuzzlesCount);
        $('#puzzleStatusText').text('ЗАДАЧА РЕШЕНА! 🎉');
        $('#puzzleStatusText').css('color', '#2ecc71');
        playSound('gameEnd');
    }

    function onDragStart(source, piece, position, orientation) {
```

- [ ] **Step 3: Branch `onDragStart` for Puzzles**

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
        
        // В режиме задач запрещаем двигать фигуры, если задача решена
        if (isPuzzleMode && currentPuzzle && currentPuzzleStep >= currentPuzzle.moves.length) {
            return false;
        }
        // Запрещаем брать фигуры противника
        if (game.turn() === 'w' && piece.search(/^b/) !== -1) return false;
        if (game.turn() === 'b' && piece.search(/^w/) !== -1) return false;

        clearArrows();
```

- [ ] **Step 4: Branch `onDrop` for Puzzles**

Find:
```javascript
    function onDrop(source, target, piece, newPos, oldPos, orientation) {
        var botLevel = parseInt($('#botLevel').val(), 10);
```
Replace with:
```javascript
    function onDrop(source, target, piece, newPos, oldPos, orientation) {
        if (isPuzzleMode && currentPuzzle) {
            // Проверка хода задачи
            var expectedMoveSAN = currentPuzzle.moves[currentPuzzleStep];
            
            // Пытаемся сделать ход, чтобы получить его SAN (чисто для проверки)
            var tempGame = new Chess(game.fen());
            var testMove = tempGame.move({ from: source, to: target, promotion: 'q' });
            
            if (testMove && testMove.san === expectedMoveSAN) {
                // Ход правильный!
                var move = game.move({ from: source, to: target, promotion: 'q' });
                board.position(game.fen());
                historyFENs.push(game.fen());
                currentViewPly = historyFENs.length - 1;
                playSoundForMove(move);
                updateMoveHistory();
                
                currentPuzzleStep++;
                
                if (currentPuzzleStep >= currentPuzzle.moves.length) {
                    puzzleCompleted();
                } else {
                    $('#puzzleStatusText').text('Верно! Ожидание хода противника...');
                    $('#puzzleStatusText').css('color', '#3498db');
                    setTimeout(playOpponentPuzzleMove, 600);
                }
            } else {
                // Ход неправильный
                $('#puzzleStatusText').text('Неверный ход! Попробуйте еще раз.');
                $('#puzzleStatusText').css('color', '#e74c3c');
                playSound('check'); // Используем звук шаха как ошибку
                return 'snapback';
            }
            return;
        }

        var botLevel = parseInt($('#botLevel').val(), 10);
```

- [ ] **Step 5: Connect Puzzle Buttons in JS**

At the very bottom of the file where other listeners are.
Find:
```javascript
    // Делаем доску адаптивной
```
Replace with:
```javascript
    // --- Кнопки режима задач ---
    $('#loadPuzzleBtn').on('click', function() {
        loadRandomPuzzle();
    });
    
    $('#exitPuzzleBtn').on('click', function() {
        exitPuzzleMode();
        // Переключаемся обратно на вкладку Игра
        $('.tab-btn[data-tab="tab-play"]').click();
    });

    // Делаем доску адаптивной
```

### Task 3: Verification
- [ ] **Step 1: Test Puzzle Mode**
Instruct the user to refresh, open the Puzzles tab, load a puzzle, and attempt to solve it by dragging pieces. Check visual and audio feedback.
