# Move History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third column to the main layout that displays the chess game's move history, updating automatically after every move.

**Architecture:** We will modify the HTML layout to include a new `.history-column`, update the CSS for flexbox layout and scrollable move history table, and write a JS function `updateMoveHistory()` to iterate over `game.history()` and dynamically populate the DOM.

**Tech Stack:** HTML5, CSS3, jQuery, chess.js.

---

### Task 1: Update HTML Layout for 3 Columns

**Files:**
- Modify: `/Users/eugene/Downloads/chess/index.html`

- [ ] **Step 1: Update Main Layout Flex Wrapper**

Update `.main-layout` to ensure it can fit 3 columns.
Run: Use `replace_file_content` on `index.html`.
Find:
```html
    <div class="main-layout" style="display: flex; gap: 30px; max-width: 1200px; margin: 0 auto; padding: 0 20px; align-items: flex-start; flex-wrap: wrap;">
```
Replace with:
```html
    <div class="main-layout" style="display: flex; gap: 30px; max-width: 1400px; margin: 0 auto; padding: 0 20px; align-items: flex-start; flex-wrap: wrap;">
```

- [ ] **Step 2: Insert History Column**

Insert the new `.history-column` between the `.board-column` and `.sidebar-column`.
Run: Use `replace_file_content` on `index.html`.
Find:
```html
                <div id="bottomMaterial" class="material-row" style="min-height: 25px; display: flex; align-items: center; margin-top: 5px;"></div>
            </div>
        </div>

        <!-- Right Column: Settings & Info -->
```
Replace with:
```html
                <div id="bottomMaterial" class="material-row" style="min-height: 25px; display: flex; align-items: center; margin-top: 5px;"></div>
            </div>
        </div>

        <!-- Middle Column: Move History -->
        <div class="history-column" style="flex: 0 0 250px; background-color: var(--bg-color); border: 1px solid var(--border-color); border-radius: 8px; box-shadow: var(--shadow); display: flex; flex-direction: column; height: 500px;">
            <h3 style="margin: 0; padding: 15px; background-color: var(--border-color); font-size: 16px; text-align: center;">История ходов</h3>
            <div id="moveHistoryList" style="flex: 1; overflow-y: auto; padding: 10px; font-family: monospace; font-size: 14px; display: flex; flex-direction: column; gap: 4px;">
                <!-- Сюда будут добавляться ходы -->
            </div>
        </div>

        <!-- Right Column: Settings & Info -->
```

### Task 2: Implement Move History Logic in JS

**Files:**
- Modify: `/Users/eugene/Downloads/chess/script.js`

- [ ] **Step 1: Create `updateMoveHistory` function**

Run: Use `replace_file_content` on `script.js`.
Insert the function before `updateStatus()`.
Find:
```javascript
    function updateStatus() {
```
Replace with:
```javascript
    function updateMoveHistory() {
        var history = game.history();
        var listEl = $('#moveHistoryList');
        listEl.empty();
        
        var row = null;
        for (var i = 0; i < history.length; i++) {
            if (i % 2 === 0) {
                // Ход белых - создаем новую строку
                row = $('<div style="display: flex; padding: 4px 8px; border-radius: 4px;"></div>');
                if ((i / 2) % 2 === 1) row.css('background-color', 'rgba(128, 128, 128, 0.1)'); // Зебра
                
                var moveNum = (i / 2 + 1) + ".";
                row.append($('<div style="width: 40px; color: #888;">' + moveNum + '</div>'));
                
                var whiteMove = $('<div class="move-text" style="flex: 1; cursor: pointer; padding: 0 4px; border-radius: 3px;" data-ply="' + i + '">' + history[i] + '</div>');
                row.append(whiteMove);
                
                // Если это последний ход в истории - добавляем заглушку для черных
                if (i === history.length - 1) {
                    row.append($('<div style="flex: 1;"></div>'));
                    listEl.append(row);
                }
            } else {
                // Ход черных - добавляем в текущую строку
                var blackMove = $('<div class="move-text" style="flex: 1; cursor: pointer; padding: 0 4px; border-radius: 3px;" data-ply="' + i + '">' + history[i] + '</div>');
                row.append(blackMove);
                listEl.append(row);
            }
        }
        
        // Автоматическая прокрутка вниз
        listEl.scrollTop(listEl[0].scrollHeight);
    }

    function updateStatus() {
```

- [ ] **Step 2: Hook up `updateMoveHistory`**

Call `updateMoveHistory()` at the end of `updateStatus()`.
Run: Use `replace_file_content` on `script.js`.
Find:
```javascript
        $('#status').text(status);
        
        highlightCheck();
    }
```
Replace with:
```javascript
        $('#status').text(status);
        
        highlightCheck();
        updateMoveHistory();
    }
```

### Task 3: Add Hover Styles for Interactive Moves

**Files:**
- Modify: `/Users/eugene/Downloads/chess/style.css`

- [ ] **Step 1: Add hover effect to move-text**

Run: Run shell command to append CSS.
```bash
cat << 'EOF' >> /Users/eugene/Downloads/chess/style.css

/* Move History */
.move-text:hover {
  background-color: var(--accent-color);
  color: white;
}
EOF
```

### Task 4: Verification

- [ ] **Step 1: Verify via browser (Manual)**

Since this is a UI-heavy HTML/JS local app, verify that the application loads correctly without syntax errors and that the Move History tab successfully records moves when dragging and dropping pieces.

Run: No automated test command. Instruct the user to refresh their browser to test.
