/**
 * Pointer interaction with the board: selecting pieces, clicking and dragging moves,
 * and the legal-move hints that go with them.
 */
import { resolveSquareClick, getLegalMovesForSquare, getMoveDestinations } from '../domain/move-input.js';
import { getDisplayedGame, isEditorMode } from '../domain/position.js';

const CLICK_DEBOUNCE_MS = 120;

export function createBoardInteraction({
    $, Chess, store, eventBus, boardView, clock, puzzle, session, getBotLevel, clearSelection
}) {
    let dragJustEnded = false;
    let lastSquareClickTime = 0;

    const isEditor = () => isEditorMode({ isPuzzleMode: puzzle.isActive(), botLevel: getBotLevel() });

    function showHints(square, positionGame, moves) {
        const legalMoves = moves || getLegalMovesForSquare(square, positionGame, isEditor(), Chess);
        boardView.showMoveHints(square, getMoveDestinations(legalMoves, positionGame));
    }

    function refreshSelectionHints() {
        const selected = store.getState().selectedSquare;
        if (!selected) {
            boardView.removeHighlights();
            return;
        }
        showHints(selected, getDisplayedGame(store.getState(), Chess));
    }

    function handleSquareClick(square) {
        const now = Date.now();
        if (now - lastSquareClickTime < CLICK_DEBOUNCE_MS) return;
        lastSquareClickTime = now;
        if (dragJustEnded) return;

        const state = store.getState();
        const positionGame = getDisplayedGame(state, Chess);
        const resolution = resolveSquareClick({
            selectedSquare: state.selectedSquare,
            clickedSquare: square,
            game: positionGame,
            isEditor: isEditor(),
            isPuzzleMode: puzzle.isActive(),
            isPuzzleCompleted: puzzle.isCompleted(),
            isThinking: state.isThinking,
            isGameOver: state.game.game_over(),
            isTimedOut: clock.timedOut,
            ChessCtor: Chess
        });

        if (resolution.action === 'select' || resolution.action === 'switch_selection') {
            store.setState({ selectedSquare: resolution.square });
            showHints(resolution.square, positionGame, resolution.moves);
        } else if (resolution.action === 'deselect') {
            clearSelection();
        } else if (resolution.action === 'move') {
            clearSelection();
            session.makeMove(resolution.from, resolution.to);
        }
    }

    function isWrongColor(game, piece) {
        return (game.turn() === 'w' && piece.search(/^b/) !== -1) ||
            (game.turn() === 'b' && piece.search(/^w/) !== -1);
    }

    eventBus.on('board:drag-start', (event) => {
        const state = store.getState();
        const game = state.game;
        if (state.isThinking || puzzle.isCompleted()) { event.cancel = true; return; }

        const editor = isEditor();
        if (!editor && isWrongColor(game, event.piece)) { event.cancel = true; return; }
        if (!puzzle.isActive() && !editor && clock.timedOut) { event.cancel = true; return; }

        // Dragging from a past position continues the game from there, which can change whose turn it is.
        session.truncateToViewedPly();

        if (getBotLevel() > 0) {
            if (game.game_over() || (!puzzle.isActive() && clock.timedOut)) { event.cancel = true; return; }
            if (event.source === 'spare' || isWrongColor(game, event.piece)) { event.cancel = true; return; }
        }

        if (event.source !== 'spare') {
            if (event.source !== state.selectedSquare) clearSelection();
            showHints(event.source, game);
        }
    });

    eventBus.on('board:drop', (event) => {
        if (event.source === event.target) {
            handleSquareClick(event.source);
            event.action = 'snapback';
            return;
        }
        if (event.target === 'offboard') {
            event.action = 'snapback';
            return;
        }

        dragJustEnded = true;
        clearSelection();
        setTimeout(() => { dragJustEnded = false; }, CLICK_DEBOUNCE_MS);

        const isFreePlacement = !puzzle.isActive() && getBotLevel() === 0;
        const accepted = isFreePlacement && event.source === 'spare'
            ? false
            : session.makeMove(event.source, event.target, event.piece);
        if (accepted) return;

        if (isFreePlacement) {
            session.applyEditedPosition(event);
        } else {
            event.action = 'snapback';
        }
    });

    eventBus.on('board:square-clicked', (event) => {
        handleSquareClick(event.square);
    });

    eventBus.on('board:mouseover-square', (event) => {
        if (store.getState().selectedSquare || !$('#highlightMovesCb').is(':checked')) return;
        const positionGame = getDisplayedGame(store.getState(), Chess);
        const moves = getLegalMovesForSquare(event.square, positionGame, isEditor(), Chess);
        if (moves.length === 0) return;
        showHints(event.square, positionGame, moves);
    });

    eventBus.on('board:mouseout-square', () => {
        if (store.getState().selectedSquare) return;
        boardView.removeHighlights();
    });

    eventBus.on('board:pointer-down-outside', (event) => {
        if (!event.isPiece && store.getState().selectedSquare) clearSelection();
    });

    return { refreshSelectionHints };
}
