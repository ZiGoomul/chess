# Chess Studies

A browser-based chess study app built with TypeScript/JavaScript, chess.js, Chessboard.js, and Stockfish.

## Requirements

- Node.js 22.12+ or 24+
- npm
- VS Code with GitHub Copilot for the workspace Context7 MCP integration

## Development

```sh
npm install
npm run dev
```

Vite prints the local URL after the development server starts.

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm run preview
```

`npm run typecheck` runs two passes: `tsconfig.json` type-checks all JavaScript under `src/` (`checkJs`, non-strict), and
`tsconfig.strict.json` checks the TypeScript modules in `src/core`, `src/domain` and `src/services/chess-engine.ts` with `strict`.
New logic should go into TypeScript modules; move a file into the strict list once it is converted.
`npm run lint` runs ESLint on JavaScript (TypeScript is covered by `tsc`).

Tests (`npm test`) cover domain logic and, through jsdom, the app controllers (`tests/board-interaction.test.js`,
`tests/game-session.test.js`, `tests/puzzle-controller.test.js`) with fake board, clock and bot from `tests/helpers/harness.js`.
`tests/styles.test.js` guards the CSS conventions (no `!important`, no inline styles, theme tokens defined).

## Задачи

«Следующая задача» берёт случайную задачу выбранной темы и сложности из открытого API Lichess
(`/api/puzzle/next`, без аккаунта; `src/services/lichess-puzzles.js`). Каждая полученная задача сохраняется в IndexedDB.
Без сети приложение предлагает сохранённые нерешённые задачи, а если сохранённых нет — подгружает наборы из
`public/puzzles/lichess/`. Как и на Lichess, засчитывается любой матующий ход.

### Импорт задач Lichess для работы без сети

Офлайн-наборы — подготовленные JSON-файлы в `public/puzzles/lichess/`. Полную CSV-базу Lichess нужно скачать и распаковать отдельно, затем преобразовать локально:

```sh
npm run import-puzzles -- /path/to/lichess_db_puzzle.csv public/puzzles/lichess 2026-09-29
```

Скрипт применяет установочный ход каждой задачи один раз и сохраняет оставшееся решение в UCI-формате. Когда сети нет и сохранённых задач не осталось, приложение импортирует эти наборы и сохраняет их в браузере.

## Разбор партий

После завершения партии против бота (мат, ничья или флажок) партия сохраняется в IndexedDB, и в фоне запускается разбор отдельным воркером Stockfish (глубина 10). Панель на вкладке «Игра» показывает до трёх ходов игрока, потерявших не меньше 0,8 пешки. Клик по моменту показывает позицию перед ошибкой и стрелку лучшего хода. Если ошибка связана с матом, рекомендуется задача с темой `mate`, иначе задача для общей практики, подобранная по рейтингу уровня бота. Попытки решения задач сохраняются локально. Пороги заданы в `src/services/game-review.js`.

## Source layout

- `src/main.js`: application entry point
- `src/app/`: game orchestration and UI event wiring
- `src/services/`: audio, clock, engine workers, and the typed Stockfish service
- `src/data/`: built-in puzzle content
- `src/storage/`: local IndexedDB persistence
- `src/ui/`: move-history rendering and navigation
- `tests/`: Node-based unit tests

The TypeScript migration is incremental: `src/services/chess-engine.ts` is the first strict-typed module; the rest of the app remains JavaScript. `src/app/game-controller.js` still coordinates board events and game flow. New features should use the existing service, data, or UI boundaries instead of adding another global script.

## Context7 in VS Code

The workspace MCP server is configured in `.vscode/mcp.json`. On first start, VS Code prompts for a Context7 API key; create one in the [Context7 dashboard](https://context7.com/dashboard). The key is stored by VS Code's input-variable handling and is not committed with the project. Project guidance in `.github/copilot-instructions.md` asks coding agents to use Context7 for current library docs. Context7 is a development assistant integration, not an application runtime dependency.

## Фигуры и звуки

Фигуры по умолчанию — набор **cburnett** (автор Colin M. L. Burnett, свободная лицензия GPLv2+ / BSD / GFDL),
взятый из репозитория [lichess-org/lila](https://github.com/lichess-org/lila) и лежащий в `public/pieces/cburnett/`.
Он работает без интернета; если набор с другого сайта (Chess.com, Lichess, Wikipedia) не загрузится, доска
подставляет cburnett.

Звуки (`src/services/audio.js`): при наличии интернета играют привычные звуки Chess.com. Без сети, пока файл
ещё не загрузился или если он не загрузился вовсе, звук синтезируется в браузере. Когда связь возвращается,
файлы загружаются снова.
