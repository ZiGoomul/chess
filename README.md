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
npm run typecheck
npm run build
npm run preview
```

## Source layout

- `src/main.js`: application entry point
- `src/app/`: game orchestration and UI event wiring
- `src/services/`: audio, clock, engine workers, and the typed Stockfish service
- `src/data/`: puzzle content
- `src/ui/`: move-history rendering and navigation
- `tests/`: Node-based unit tests

The TypeScript migration is incremental: `src/services/chess-engine.ts` is the first strict-typed module; the rest of the app remains JavaScript. `src/app/game-controller.js` still coordinates board events and game flow. New features should use the existing service, data, or UI boundaries instead of adding another global script.

## Context7 in VS Code

The workspace MCP server is configured in `.vscode/mcp.json`. On first start, VS Code prompts for a Context7 API key; create one in the [Context7 dashboard](https://context7.com/dashboard). The key is stored by VS Code's input-variable handling and is not committed with the project. Project guidance in `.github/copilot-instructions.md` asks coding agents to use Context7 for current library docs. Context7 is a development assistant integration, not an application runtime dependency.
