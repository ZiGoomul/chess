# Архитектурная спецификация: Event-Driven & Store декомпозиция шахматного приложения

**Дата:** 2 октября 2026 г.  
**Статус:** На согласовании (Draft / Ready for Review)  
**Область:** Рефакторинг монолитного `src/app/game-controller.js` (~1550 строк) и `style.css` (~1180 строк).

---

## 1. Цели и мотивация

1. **Разделение ответственности (SoC)**: `src/app/game-controller.js` объединяет логику партии, UI доски, клики/перетаскивания, часы, бота, анализ Stockfish, стрелки подсказок, оценку позиции, режим этюдов (puzzle mode), обзор партий, модальные окна и переключение вкладок.
2. **Событийно-ориентированная архитектура (Event-Driven / Store)**: перевести приложение на единую шину событий (`EventBus`) и централизованное хранилище состояния (`GameStore`), устранив спагетти взаимных вызовов между UI-элементами.
3. **Модульность стилей**: разбить 1180 строк `style.css` на логические CSS-модули (`base.css`, `components.css`, `board.css`, `review.css`, `time-control.css`) без изменения визуального оформления.
4. **Безопасность и отсутствие регрессий**: гарантировать 100% работоспособность всех существующих функций (клик-энд-клик, drag-and-drop, подсказки, часы, бот, база этюдов, ревью, тесты 40/40).

---

## 2. Целевая архитектура

```
                         ┌───────────────────┐
                         │   User / DOM      │
                         └─────────┬─────────┘
                                   │ DOM events
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              VIEW LAYER                                │
│  ┌───────────────┐ ┌────────────────┐ ┌─────────────────────────────┐  │
│  │   BoardView   │ │   EvalBarView  │ │        MaterialView         │  │
│  │ (arrows, dots,│ │ (score & bar)  │ │      (piece counters)       │  │
│  │  clicks, drag)│ └────────────────┘ └─────────────────────────────┘  │
│  ├───────────────┤ ├────────────────┤ ├─────────────────────────────┤  │
│  │   ClockView   │ │   PuzzleView   │ │          ShellView          │  │
│  │ (timers & bar)│ │(catalog, score)│ │ (tabs, theme, controls, FEN)│  │
│  └───────────────┘ └────────────────┘ └─────────────────────────────┘  │
└──────────────────┬───────────────────────────────▲─────────────────────┘
                   │ emits UI events               │ subscribes to state
                   ▼                               │ & domain events
┌──────────────────────────────────────────────────┴─────────────────────┐
│                            CORE / STORE                                │
│  ┌───────────────────────────────┐   ┌──────────────────────────────┐  │
│  │           EventBus            │   │          GameStore           │  │
│  │  (.on, .off, .emit)           │◄─►│   (holds state & reducer)    │  │
│  └───────────────────────────────┘   └──────────────────────────────┘  │
└──────────────────▲───────────────────────────────▲─────────────────────┘
                   │                               │
┌──────────────────┴───────────────────────────────┴─────────────────────┐
│                       SERVICES & COORDINATORS                          │
│  ┌───────────────────────┐ ┌──────────────────────┐ ┌───────────────┐  │
│  │     BotCoordinator    │ │  AnalysisCoordinator│ │PuzzleCoordinator││
│  │ (Stockfish AI play)   │ │  (Eval worker, hints)│ │(solver runner)│  │
│  ├───────────────────────┴─┴──────────────────────┴─┴───────────────┤  │
│  │ Existing services: Clock, Audio, EngineWorkers, PostGameReview...│  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Спецификация Core: EventBus & GameStore

### 3.1. `src/core/event-bus.js`
Минималистичная, типобезопасная и изолированная шина событий:
```javascript
export function createEventBus() {
  const listeners = new Map();
  return {
    on(event, handler) { ... },
    off(event, handler) { ... },
    emit(event, payload) { ... },
    clear() { ... }
  };
}
```

### 3.2. События системы (Event Map)
| Событие | Источник | Payload | Описание |
|---|---|---|---|
| `board:square-clicked` | `BoardView` | `{ square }` | Клик по клетке доски |
| `board:move-attempted` | `BoardView` | `{ source, target, piece }` | Попытка хода через drag или click |
| `board:orientation-changed` | `ShellView` / `BoardView` | `{ orientation }` | Поворот доски (white/black) |
| `game:move-made` | `GameStore` / Orchestrator | `{ move, fen, san, turn, isGameOver }` | Совершён валидный ход |
| `game:ply-changed` | `MoveHistoryView` / Store | `{ ply, fen }` | Навигация по истории ходов |
| `game:reset` | `ShellView` / Orchestrator | `{ fen, timeControl }` | Новая партия или сброс |
| `clock:tick` | `Clock` service | `{ whiteMs, blackMs, activeColor }` | Тик таймера |
| `clock:timeout` | `Clock` service | `{ loserColor }` | Флаг упал |
| `engine:eval-updated` | `AnalysisCoordinator` | `{ cp, mate }` | Оценка позиции для полосы оценки |
| `engine:hints-updated` | `AnalysisCoordinator` | `{ arrows }` | Лучшие ходы (стрелки подсказок) |
| `bot:move-ready` | `BotCoordinator` | `{ from, to, promotion }` | Бот рассчитал ход |
| `puzzle:loaded` | `PuzzleCoordinator` | `{ puzzle, fen }` | Загружена новая задача |
| `puzzle:step-result` | `PuzzleCoordinator` | `{ correct, completed, nextMove }` | Результат хода в задаче |
| `puzzle:completed` | `PuzzleCoordinator` | `{ puzzle, mistakes }` | Задача решена |
| `puzzle:exited` | `PuzzleCoordinator` | `{}` | Выход из режима задач |
| `theme:changed` | `ShellView` | `{ theme, boardTheme, pieceTheme }` | Смена цветового оформления |

### 3.3. `src/core/game-store.js`
Центральное хранилище состояния партии и сессии:
- **Состояние**:
  - `game`: экземпляр `new Chess()`
  - `historyFENs`: `string[]`
  - `currentViewPly`: `number`
  - `selectedSquare`: `string | null`
  - `mode`: `'free' | 'bot' | 'puzzle'`
  - `orientation`: `'white' | 'black'`
  - `isThinking`: `boolean` (бот или движок вычисляет)
  - `settings`: `{ highlightMoves: boolean, highlightAttacks: boolean, highlightDefenses: boolean, autoHint: boolean, botLevel: number }`
  - `eval`: `{ cp: number | null, mate: number | null }`
- **Методы**:
  - `getState()`
  - `setState(partialState)` (уведомляет слушателей при изменении)
  - `subscribe(fn)`

---

## 4. Декомпозиция UI (View Layer)

Все View-модули создаются фабриками, принимают зависимости (`{ eventBus, store, $ }`) и инкапсулируют свой DOM:

### 4.1. `src/ui/board-view.js`
- **Отвечает за**:
  - Инициализацию `Chessboard.js` (`#myBoard`).
  - Управление кликами и жестами: `pointerdown`, `pointerup`, отслеживание дельты клика для трекпадов, вычисление координат через `getSquareFromCoords`.
  - Отрисовку подсказок возможных ходов (`.selected-square`, `.move-dest-marker`).
  - Отрисовку SVG-стрелок (подсказки движка, multi-PV) через `#arrowSvg`.
  - Подсветку атакованных/защищённых фигур (`.attacked-square`, `.defended-square`) и шаха (`.check-square`).
- **Слушает**: `game:move-made`, `game:ply-changed`, `engine:hints-updated`, `board:orientation-changed`, `settings:changed`.
- **Эмитит**: `board:square-clicked`, `board:move-attempted`.

### 4.2. `src/ui/eval-bar-view.js`
- **Отвечает за**: Отрисовку полоски оценки (`#evalBar`, `#evalBarFill`, `#evalScoreTop`, `#evalScoreBottom`).
- **Форматирование**: перевод `cp` в пешечный эквивалент (`+1.4`), отображение матов (`M2`, `-M1`).
- **Слушает**: `engine:eval-updated`, `board:orientation-changed`.

### 4.3. `src/ui/material-view.js`
- **Отвечает за**: Подсчет сбитых фигур и материального перевеса, отрисовку плашек фигур в `#topMaterial` и `#bottomMaterial`.
- **Слушает**: `game:move-made`, `game:ply-changed`, `board:orientation-changed`.

### 4.4. `src/ui/clock-view.js`
- **Отвечает за**: Обновление цифровых часов (`#topClock`, `#bottomClock`), подсветку активного игрока, индикацию цейтнота (<30 сек).
- **Слушает**: `clock:tick`, `board:orientation-changed`, `game:reset`.

### 4.5. `src/ui/puzzle-view.js`
- **Отвечает за**: Вкладку «Задачи»: отображение статуса каталога, количества задач, прогресса решения текущего этюда, сообщений об успехе/ошибке.
- **Слушает**: `puzzle:loaded`, `puzzle:step-result`, `puzzle:completed`, `puzzle:exited`.

### 4.6. `src/ui/shell-view.js`
- **Отвечает за**: Общий UI каркас страницы:
  - Переключение вкладок (`.tab-btn`).
  - Переключение темы сайта (светлая/тёмная), селекторы тем доски и фигур.
  - Модальное окно контроля времени (`#timeControlDialog`, пресеты, кастомные поля).
  - Кнопки экспорта/импорта FEN, копирования PGN.
  - Селектор уровня сложности бота (`#botLevel`).

---

## 5. Сервисы и координаторы (Services Layer)

### 5.1. `src/services/bot-coordinator.js`
- Инкапсулирует работу с `chess-engine`:
  - Настройка уровня мастерства бота (`updateStockfishLevel`).
  - Отправка запроса на ход бота после хода человека.
  - Отмена поиска при перезапуске или отмене хода.
  - Эмитит `bot:move-ready`.

### 5.2. `src/services/analysis-coordinator.js`
- Инкапсулирует вычисление оценки и подсказок в фоновом режиме:
  - Автоподсказка (`autoHintIfNeeded`).
  - Обработка `MultiPV` линий для стрелок.
  - Эмитит `engine:eval-updated` и `engine:hints-updated`.

### 5.3. `src/services/puzzle-coordinator.js`
- Управляет жизненным циклом задачи:
  - Загрузка из базы/каталога (`loadRandomPuzzle`, `loadPuzzle`).
  - Проверка ходов игрока по цепочке UCI.
  - Очередь ответного хода соперника с задержкой 400мс.
  - Подсчёт ошибок, фиксация попытки в `localRepository`.

---

## 6. Главный оркестратор: `src/app/game-orchestrator.js`

Заменяет гигантский `src/app/game-controller.js`.
Его размер составит всего **~200–300 строк**:
- Инициализирует `EventBus` и `GameStore`.
- Инициализирует сервисы: `Audio`, `Clock`, `EngineWorkers`, `PostGameReview`, `LocalDatabase`, `PuzzleCatalog`.
- Инициализирует координаторы: `BotCoordinator`, `AnalysisCoordinator`, `PuzzleCoordinator`.
- Инициализирует Views: `BoardView`, `EvalBarView`, `MaterialView`, `ClockView`, `PuzzleView`, `ShellView`, `MoveHistoryView`, `PostGameReviewView`.
- Обрабатывает бизнес-правила (например, валидация хода через `Chess.js`, переключение таймера, запуск бота или ответного хода в задаче, сохранение игры при завершении).

---

## 7. Декомпозиция стилей: `style.css`

Разбиваем 1180 строк `style.css` на 5 файлов в каталоге `styles/`:
1. `styles/base.css` (~120 строк): CSS-переменные `:root` и `[data-theme="dark"]`, сброс стилей, типографика, разметка `.main-layout`, `.app-header`.
2. `styles/components.css` (~200 строк): Кнопки, вкладки `.tab-btn`, переключатели `.switch`, карточки панелей, плашки материала.
3. `styles/board.css` (~250 строк): Обертка `#boardWrapper`, переопределения Chessboard.js, `.selected-square`, `.move-dest-marker` (точки и кольца), подсветка шаха и атак, темы досок, полоса оценки `.eval-bar`.
4. `styles/review.css` (~350 строк): Таблица истории ходов, блок обзора партий, карточки разбора, бэйджи точности, график оценки.
5. `styles/time-control.css` (~260 строк): Модальное окно таймера, сетка пресетов времени, кастомные слайдеры и бейджи категорий.

Корневой `style.css` превращается в чистый модульный индекс:
```css
@import './styles/base.css';
@import './styles/components.css';
@import './styles/board.css';
@import './styles/review.css';
@import './styles/time-control.css';
```

---

## 8. План поэтапной реализации (без регрессий)

Рефакторинг выполняется пошагово с непрерывной проверкой `npm test` и `npm run build`:

1. **Фаза 1: Модуляризация CSS**
   - Выделить `styles/base.css`, `components.css`, `board.css`, `review.css`, `time-control.css`.
   - Заменить содержимое `style.css` на `@import`.
   - Проверить сборку Vite и визуальное отображение.

2. **Фаза 2: Создание ядра (Core)**
   - Реализовать `src/core/event-bus.js` + unit-тесты (`tests/event-bus.test.js`).
   - Реализовать `src/core/game-store.js` + unit-тесты (`tests/game-store.test.js`).

3. **Фаза 3: Выделение вспомогательных UI-компонентов**
   - `src/ui/eval-bar-view.js`
   - `src/ui/material-view.js`
   - `src/ui/clock-view.js`
   - Подключить их к текущему контроллеру, проверить работоспособность.

4. **Фаза 4: Выделение координаторов**
   - `src/services/bot-coordinator.js`
   - `src/services/analysis-coordinator.js`
   - `src/services/puzzle-coordinator.js` + `src/ui/puzzle-view.js`

5. **Фаза 5: Выделение `BoardView` и `ShellView`**
   - Вынести обработку жестов, кликов, Chessboard.js и стрелок в `BoardView`.
   - Вынести модалки, темы, контролы в `ShellView`.

6. **Фаза 6: Сборка `game-orchestrator.js` и финальная верификация**
   - `src/app/game-controller.js` становится тонким фасадом или переименовывается в оркестратор.
   - Проверка всех сценариев:
     - Drag-and-drop и клик-энд-клик ходы.
     - Игра с ботом и стрелки подсказок.
     - Контроль времени и флаги.
     - Режим решения этюдов.
     - Сохранение и разбор партии.
     - Переключение тем и вкладок.
   - Запуск `npm test` и `npm run build`.
