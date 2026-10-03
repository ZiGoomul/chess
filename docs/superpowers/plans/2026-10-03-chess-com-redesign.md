# Комплексный редизайн в стиле Chess.com: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полный редизайн веб-интерфейса шахматного приложения с внедрением дизайн-системы Chess.com (фирменная тёмная палитра, зелёно-кремовая доска, карточки игроков с часами, монолитная правая панель и стилизованные контролы).

**Architecture:** Модульное обновление CSS-токенов и компонентов (`styles/base.css`, `styles/board.css`, `styles/components.css`, `styles/review.css`, `styles/time-control.css`) с обогащением структуры HTML в `index.html` (карточки игроков, бейджи, навигация). Вся логика доски, движка Stockfish, часов и нотации сохраняется без регрессий.

**Tech Stack:** HTML5, CSS3 (Custom Properties, Flexbox, CSS Grid), JavaScript (ES Modules), chessboard.js, chess.js.

---

### Task 1: Токены дизайн-системы и базовые темы (`styles/base.css`)

**Files:**
- Modify: `styles/base.css`
- Test: `tests/` (регрессионный прогон `npm test` и `npm run typecheck`)

- [ ] **Step 1: Обновить CSS-переменные тем (тёмная и светлая) и глобальные стили**

Заменить цветовую палитру в `styles/base.css` на фирменные токены Chess.com:
```css
:root {
    --bg-color: #f0ece9;
    --text-color: #262421;
    --text-primary: #262421;
    --text-secondary: #686460;
    --panel-bg: #ffffff;
    --surface-subtle: #f7f6f5;
    --surface-hover: #e8e6e3;
    --border-color: #dcd8d4;
    --accent-color: #81b64c;
    --accent-hover: #a3d160;
    --accent-active: #6c9e3d;
    --accent-shadow: #588a2b;
    --clock-bg: #e2dfdc;
    --clock-active-border: #81b64c;
    --shadow: 0 4px 16px rgba(0,0,0,0.08);
}

[data-theme="dark"] {
    --bg-color: #262421;
    --text-color: #e0e0e0;
    --text-primary: #ffffff;
    --text-secondary: #9e9a95;
    --panel-bg: #312e2b;
    --surface-subtle: #272522;
    --surface-hover: #383531;
    --border-color: #3d3935;
    --accent-color: #81b64c;
    --accent-hover: #a3d160;
    --accent-active: #6c9e3d;
    --accent-shadow: #588a2b;
    --clock-bg: #211f1c;
    --clock-active-border: #81b64c;
    --shadow: 0 8px 24px rgba(0,0,0,0.4);
}
```
Также настроить кастомный скроллбар в стиле Chess.com:
```css
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}
::-webkit-scrollbar-track {
    background: var(--surface-subtle);
}
::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
    background: #555;
}
```

- [ ] **Step 2: Запустить проверку тестов и типов**

Run: `npm test && npm run typecheck`  
Expected: PASS (все 59 тестов проходят)

- [ ] **Step 3: Зафиксировать изменения в git**

```bash
git add styles/base.css
git commit -m "style: implement Chess.com color tokens and base theme styles"
```

---

### Task 2: Оформление доски, клеток, маркеров ходов и полосы оценки (`styles/board.css`)

**Files:**
- Modify: `styles/board.css`
- Test: `tests/`

- [ ] **Step 1: Переопределить расцветку доски и маркеры ходов под Chess.com**

В `styles/board.css`:
1. Установить цвета клеток chessboard.js:
```css
.white-1e1d7 {
    background-color: #ebecd0 !important;
    color: #779556 !important;
}

.black-3c85d {
    background-color: #779556 !important;
    color: #ebecd0 !important;
}
```
2. Подсветка последнего хода и выбранной клетки:
```css
.square-55d63.selected-square {
    background-color: #bbcb43 !important;
}
.square-55d63.white-1e1d7.selected-square {
    background-color: #f5f682 !important;
}
.square-55d63.last-move-highlight {
    background-color: rgba(245, 246, 130, 0.65) !important;
}
.square-55d63.black-3c85d.last-move-highlight {
    background-color: rgba(187, 203, 67, 0.65) !important;
}
```
3. Маркеры возможных ходов (аккуратные точки по центру для тихих ходов и кольца для взятий):
```css
.move-dest-dot {
    width: 28%;
    height: 28%;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.22);
    pointer-events: none;
}
.move-dest-ring {
    width: 86%;
    height: 86%;
    border-radius: 50%;
    border: 4px solid rgba(0, 0, 0, 0.25);
    background-color: transparent;
    pointer-events: none;
}
```
4. Обновить полосу оценки (`#evalBarContainer`):
```css
#evalBarContainer {
    width: 24px;
    border-radius: 4px;
    overflow: hidden;
    background-color: #312e2b;
    border: 1px solid var(--border-color);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
#evalBarWhite {
    background-color: #ffffff;
    transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

- [ ] **Step 2: Запустить проверку тестов и типов**

Run: `npm test && npm run typecheck`  
Expected: PASS

- [ ] **Step 3: Зафиксировать изменения в git**

```bash
git add styles/board.css
git commit -m "style: add Chess.com board squares, move markers and eval bar styles"
```

---

### Task 3: Карточки игроков (Player Badges) и шахматные часы (`index.html`, `styles/components.css`, `styles/time-control.css`)

**Files:**
- Modify: `index.html:18-62`
- Modify: `styles/components.css`
- Modify: `styles/time-control.css`
- Test: `tests/`

- [ ] **Step 1: Обновить разметку зоны вокруг доски в `index.html`**

Оформить верхнюю и нижнюю плашки игроков в `.player-badge`:
```html
<!-- Top Player Badge -->
<div class="player-badge top-player">
    <div class="player-info">
        <div class="player-avatar">🤖</div>
        <div class="player-details">
            <span class="player-name" id="topPlayerName">Бот</span>
            <span class="player-rating">1500</span>
        </div>
        <div id="topMaterial" class="material-row"></div>
    </div>
    <div id="topClock" class="chess-clock">05:00</div>
</div>

<!-- Board Area with Eval bar -->
...

<!-- Bottom Player Badge -->
<div class="player-badge bottom-player">
    <div class="player-info">
        <div class="player-avatar">👤</div>
        <div class="player-details">
            <span class="player-name" id="bottomPlayerName">Вы</span>
            <span class="player-rating">1500</span>
        </div>
        <div id="bottomMaterial" class="material-row"></div>
    </div>
    <div id="bottomClock" class="chess-clock">05:00</div>
</div>
```

- [ ] **Step 2: Стилизовать `.player-badge`, `.player-avatar`, `.player-details` и часы Chess.com**

В `styles/components.css` и `styles/time-control.css`:
```css
.player-badge {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 10px;
    background: transparent;
    border-radius: 6px;
    min-height: 44px;
    margin-left: 34px; /* выравнивание с доской относительно eval bar */
}

.player-info {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
}

.player-avatar {
    width: 34px;
    height: 34px;
    border-radius: 6px;
    background: var(--surface-subtle);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    border: 1px solid var(--border-color);
}

.player-details {
    display: flex;
    align-items: center;
    gap: 6px;
}

.player-name {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary);
}

.player-rating {
    font-size: 12px;
    color: var(--text-secondary);
    background: var(--surface-subtle);
    padding: 2px 6px;
    border-radius: 4px;
}

.chess-clock {
    font-family: ui-monospace, "SF Mono", Monaco, Consolas, monospace;
    font-size: 20px;
    font-weight: 700;
    background: var(--clock-bg);
    color: var(--text-primary);
    padding: 5px 12px;
    border-radius: 6px;
    min-width: 72px;
    text-align: center;
    border: 2px solid transparent;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
    transition: all 0.2s ease;
}

.chess-clock.active {
    border-color: var(--clock-active-border);
    background: #1a1917;
    color: #ffffff;
    box-shadow: 0 0 8px rgba(129, 182, 76, 0.4);
}

.chess-clock.danger {
    color: #ff4757;
    border-color: #ff4757;
    animation: clock-pulse 1s infinite alternate;
}
```

- [ ] **Step 3: Запустить проверку тестов и типов**

Run: `npm test && npm run typecheck`  
Expected: PASS

- [ ] **Step 4: Зафиксировать изменения в git**

```bash
git add index.html styles/components.css styles/time-control.css
git commit -m "feat: add Chess.com player badges and styled chess clocks"
```

---

### Task 4: Шапка боковой панели, табы и 3D-кнопки действий (`styles/components.css`, `index.html`)

**Files:**
- Modify: `styles/components.css`
- Modify: `index.html:10-15`
- Test: `tests/`

- [ ] **Step 1: Обновить шапку приложения и стили вкладок панели**

В `styles/components.css`:
```css
/* Шапка приложения в стиле Chess.com */
.app-header {
    background: var(--surface-subtle) !important;
    border-bottom: 1px solid var(--border-color);
    box-shadow: none !important;
}

/* Вкладки боковой панели */
.tabs-header {
    display: flex;
    background: var(--surface-subtle);
    border-bottom: 1px solid var(--border-color);
    border-radius: 8px 8px 0 0;
    overflow: hidden;
}

.tab-btn {
    flex: 1;
    padding: 12px 14px;
    background: transparent;
    color: var(--text-secondary);
    border: none;
    border-radius: 0;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    position: relative;
    box-shadow: none;
    transition: color 0.2s, background 0.2s;
}

.tab-btn:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
}

.tab-btn.active {
    background: var(--panel-bg);
    color: var(--text-primary);
}

.tab-btn.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--accent-color);
}
```

- [ ] **Step 2: Оформить 3D-кнопки Chess.com**

```css
/* Главная CTA-кнопка (зелёная с нижним бортиком) */
.btn-primary, button.primary-btn, #startCustomTimeBtn, #newGameBtn {
    background-color: var(--accent-color);
    color: #ffffff;
    font-weight: 700;
    border-radius: 6px;
    box-shadow: 0 4px 0 var(--accent-shadow);
    border: none;
    cursor: pointer;
    padding: 10px 18px;
    transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.2s;
}

.btn-primary:hover, button.primary-btn:hover, #startCustomTimeBtn:hover, #newGameBtn:hover {
    background-color: var(--accent-hover);
}

.btn-primary:active, button.primary-btn:active, #startCustomTimeBtn:active, #newGameBtn:active {
    transform: translateY(3px);
    box-shadow: 0 1px 0 var(--accent-shadow);
}

/* Второстепенные кнопки (серые) */
.btn-secondary, button.secondary-btn, #flipBoardBtn, #resignBtn, #drawBtn {
    background-color: var(--surface-subtle);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    box-shadow: 0 2px 0 var(--border-color);
    border-radius: 6px;
}

.btn-secondary:hover, button.secondary-btn:hover, #flipBoardBtn:hover, #resignBtn:hover, #drawBtn:hover {
    background-color: var(--surface-hover);
}

.btn-secondary:active, button.secondary-btn:active, #flipBoardBtn:active, #resignBtn:active, #drawBtn:active {
    transform: translateY(2px);
    box-shadow: none;
}
```

- [ ] **Step 3: Запустить проверку тестов и типов**

Run: `npm test && npm run typecheck`  
Expected: PASS

- [ ] **Step 4: Зафиксировать изменения в git**

```bash
git add styles/components.css index.html
git commit -m "style: implement Chess.com styled navigation tabs and 3D action buttons"
```

---

### Task 5: Таблица ходов (Нотация) и кнопки навигации (`styles/review.css`, `styles/components.css`)

**Files:**
- Modify: `styles/review.css`
- Modify: `styles/components.css`
- Test: `tests/`

- [ ] **Step 1: Стилизовать таблицу ходов и навигационные кнопки**

В `styles/review.css` и `styles/components.css`:
```css
/* Таблица ходов в стиле Chess.com */
.move-history-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    color: var(--text-primary);
}

.move-row {
    display: flex;
    align-items: center;
    padding: 3px 6px;
    border-radius: 4px;
    transition: background 0.15s;
}

.move-row:nth-child(even) {
    background: rgba(0, 0, 0, 0.08);
}

.move-number {
    width: 32px;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
}

.move-white, .move-black {
    flex: 1;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
}

.move-white:hover, .move-black:hover {
    background: var(--surface-hover);
}

.move-white.active, .move-black.active {
    background: #45423e;
    color: #ffffff;
}

/* Кнопки навигации по партии (|<<, <, >, >>|) */
.history-controls {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 10px;
    background: var(--surface-subtle);
    border-top: 1px solid var(--border-color);
    border-radius: 0 0 8px 8px;
}

.nav-btn {
    flex: 1;
    max-width: 60px;
    height: 38px;
    background: var(--surface-subtle);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 0 var(--border-color);
    transition: transform 0.1s, background 0.15s;
}

.nav-btn:hover {
    background: var(--surface-hover);
}

.nav-btn:active {
    transform: translateY(2px);
    box-shadow: none;
}
```

- [ ] **Step 2: Запустить проверку тестов и типов**

Run: `npm test && npm run typecheck`  
Expected: PASS

- [ ] **Step 3: Зафиксировать изменения в git**

```bash
git add styles/review.css styles/components.css
git commit -m "style: update move notation table and game navigation controls in Chess.com aesthetic"
```

---

### Task 6: Модальные окна: выбор времени и окончание партии (`styles/time-control.css`, `index.html`)

**Files:**
- Modify: `styles/time-control.css`
- Modify: `index.html:62-97`
- Test: `tests/`

- [ ] **Step 1: Обновить сетку пресетов времени и оформление диалогов**

В `styles/time-control.css`:
```css
/* Диалог выбора контроля времени */
.time-control-dialog {
    background: var(--panel-bg);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    max-width: 480px;
    width: 90%;
}

.time-control-options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
    margin-top: 8px;
}

.time-control-option {
    background: var(--surface-subtle);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px 8px;
    text-align: center;
    color: var(--text-primary);
    box-shadow: 0 2px 0 var(--border-color);
    cursor: pointer;
    transition: transform 0.1s, border-color 0.2s, background 0.2s;
}

.time-control-option:hover {
    background: var(--surface-hover);
    border-color: var(--accent-color);
}

.time-control-option:active {
    transform: translateY(2px);
}

.time-control-option strong {
    display: block;
    font-size: 16px;
    margin-bottom: 2px;
}

.time-control-option span {
    font-size: 11px;
    color: var(--text-secondary);
}

/* Окно окончания партии */
#gameOverOverlay {
    backdrop-filter: blur(4px);
    background: rgba(18, 17, 15, 0.75) !important;
}

#gameOverOverlay > div, .game-over-card {
    background: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 30px 40px;
    text-align: center;
    box-shadow: 0 16px 48px rgba(0,0,0,0.6);
}
```

- [ ] **Step 2: Запустить проверку тестов и типов**

Run: `npm test && npm run typecheck`  
Expected: PASS

- [ ] **Step 3: Зафиксировать изменения в git**

```bash
git add styles/time-control.css index.html
git commit -m "style: polish time control modal and game over overlay to match Chess.com"
```

---

### Task 7: Финальная полировка, мобильная адаптация и регрессионная верификация

**Files:**
- Modify: `styles/base.css`
- Modify: `index.html`
- Test: полный прогон тестов `npm test` и `npm run typecheck`

- [ ] **Step 1: Проверить адаптивность мобильного вида и плавность переключения тем**

Убедиться, что на мобильных экранах (`@media (max-width: 768px)`):
- Карточки игроков корректно позиционируются с доской (`margin-left: 0`).
- Доска занимает доступную ширину без горизонтального скролла.
- Вкладки и кнопки удобно нажимаются пальцем (минимальный tap target 40px).

- [ ] **Step 2: Запустить полную автоматическую верификацию**

Run: `npm test && npm run typecheck`  
Expected: PASS (все 59 тестов пройдены, 0 ошибок типизации)

- [ ] **Step 3: Финальный коммит этапа редизайна**

```bash
git add .
git commit -m "feat(ui): complete comprehensive Chess.com visual redesign"
```
