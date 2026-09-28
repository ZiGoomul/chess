# Chess App UI Redesign Spec

## Overview
A visual and structural redesign of the single-page chess training application. The goal is to transition from a basic, vertically stacked utility layout to a modern, user-friendly, dual-column interface inspired by platforms like Chess.com and Lichess.

## Architecture & Layout
- **Global Layout:** Flexbox-based two-column layout. 
  - **Left Column:** Main focus area containing the chessboard and material advantage indicators.
  - **Right Column:** A fixed-width sidebar containing all controls and settings, organized into tabs.
- **Theming:** 
  - Default to a dark mode aesthetic (deep grays/blues).
  - Include a global Light/Dark mode toggle (e.g., ☀️/🌙 icon in the header).
  - Use modern UI paradigms: rounded corners (`border-radius`), soft box-shadows, toggle switches instead of native checkboxes, and a clean sans-serif font (e.g., system-ui, Inter, or Roboto).

## Component Breakdown

### 1. Header
- App title.
- Theme toggle button (Dark/Light).

### 2. Left Column (Board Area)
- **Top Material Indicator:** Captured pieces and score advantage for the opponent.
- **Chessboard:** Centered, with a soft shadow to lift it from the background.
- **Bottom Material Indicator:** Captured pieces and score advantage for the player.
- **Game Over Overlay:** Retained from previous implementation, styled to match the new dark/light theme dynamically.

### 3. Right Column (Sidebar Tabs)
The sidebar uses a tabbed navigation system to prevent UI clutter.

#### Tab 1: Game / Play (Default)
- **Match Status:** Large, clear text indicating current state (e.g., "Your Turn", "Bot Thinking...", "Checkmate").
- **Opponent Settings:** Select dropdown for Bot level (Disabled/Editor up to GM).
- **Hint System:** 
  - "Suggest Move" button.
  - Hint level selector.
  - Auto-hint toggle switch.

#### Tab 2: Setup / FEN
- **Board Controls:** "Flip Board", "Start Position", "Clear Board" buttons.
- **FEN Controls:** Text input for FEN string, "Get FEN", and "Set FEN" buttons.

#### Tab 3: Appearance
- **Piece Theme:** Dropdown selecting piece skins (Neo, Classic, Wikipedia, CBurnett, etc.).
- **Board Theme:** Dropdown selecting board colors (Green, Wood, Blue, Gray).
- **Move Highlights:** Toggle switch for enabling/disabling hover highlights for valid moves.

## Technical Details
- **HTML/CSS:** Implement a tab switching mechanism using simple JavaScript or CSS (hidden/active classes). Define global CSS variables (CSS Custom Properties) for colors (`--bg-color`, `--text-color`, `--sidebar-bg`, `--accent-color`) to make the Light/Dark mode switch seamless.
- **JS Modifications:** 
  - Add logic for tab switching.
  - Add logic for toggling the `data-theme="light"` or `data-theme="dark"` attribute on the `<body>`.
  - Refactor existing control event listeners to target the newly structured HTML elements without breaking underlying chess logic.
