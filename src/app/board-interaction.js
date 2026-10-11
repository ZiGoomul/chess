/**
 * Pointer interaction with the board: selecting pieces, clicking and dragging moves,
 * and the legal-move hints that go with them.
 */
import { resolveSquareClick, getLegalMovesForSquare, getMoveDestinations } from '../domain/move-input.js';
import { getDisplayedGame, isEditorMode, isHistoricalPosition } from '../domain/position.js';

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
        const historical = isHistoricalPosition(state);
        const resolution = resolveSquareClick({
            selectedSquare: state.selectedSquare,
            clickedSquare: square,
            game: positionGame,
            isEditor: isEditor(),
            isPuzzleMode: puzzle.isActive(),
            isPuzzleCompleted: puzzle.isCompleted(),
            isThinking: state.isThinking,
            isGameOver: historical ? positionGame.game_over() : state.game.game_over(),
            isTimedOut: historical ? false : clock.timedOut,
            ChessCtor: Chess
        });

        if (resolution.action === 'select' || resolution.action === 'switch_selection') {
            store.setState({ selectedSquare: resolution.square });
            showHints(resolution.square, positionGame, resolution.moves);
        } else if (resolution.action === 'deselect') {
            clearSelection();
        } else if (resolution.action === 'move') {
            clearSelection();
            commitMove(resolution.from, resolution.to);
        }
    }

    /** The colour of a pawn whose legal move from → to promotes, else null. */
    function promotingColor(from, to) {
        const game = getDisplayedGame(store.getState(), Chess);
        const piece = game.get(from);
        if (!piece || piece.type !== 'p' || to[1] !== (piece.color === 'w' ? '8' : '1')) return null;
        // In the editor either side may move, so ask as the pawn's side
        const parts = game.fen().split(' ');
        parts[1] = piece.color;
        parts[3] = '-';
        const asMover = new Chess();
        if (!asMover.load(parts.join(' '))) return null;
        return asMover.moves({ square: from, verbose: true }).some(move => move.to === to && move.promotion) ? piece.color : null;
    }

    /** Makes a move, asking which piece a promoting pawn becomes. */
    async function commitMove(from, to, piece) {
        const color = promotingColor(from, to);
        if (!color || typeof boardView.choosePromotion !== 'function') {
            return piece === undefined ? session.makeMove(from, to) : session.makeMove(from, to, piece);
        }
        const choice = await boardView.choosePromotion(to, color);
        if (!choice) return false;
        return session.makeMove(from, to, piece, choice);
    }

    function isWrongColor(game, piece) {
        return (game.turn() === 'w' && piece.search(/^b/) !== -1) ||
            (game.turn() === 'b' && piece.search(/^w/) !== -1);
    }

    eventBus.on('board:drag-start', (event) => {
        const state = store.getState();
        if (state.isThinking || puzzle.isCompleted()) { event.cancel = true; return; }

        const editor = isEditor();
        const historical = isHistoricalPosition(state);
        const positionGame = getDisplayedGame(state, Chess);

        if (!editor && isWrongColor(positionGame, event.piece)) { event.cancel = true; return; }
        if (!puzzle.isActive() && !editor && !historical && clock.timedOut) { event.cancel = true; return; }

        // Dragging from a past position continues the game from there, which can change whose turn it is.
        session.truncateToViewedPly();

        const liveGame = store.getState().game;
        if (getBotLevel() > 0) {
            if (liveGame.game_over() || (!puzzle.isActive() && !historical && clock.timedOut)) { event.cancel = true; return; }
            if (event.source === 'spare' || isWrongColor(liveGame, event.piece)) { event.cancel = true; return; }
        }

        if (event.source !== 'spare') {
            if (event.source !== state.selectedSquare) clearSelection();
            showHints(event.source, liveGame);
        }
    });

    eventBus.on('board:drop', (event) => {
        if (event.source === event.target) {
            handleSquareClick(event.source);
            event.action = 'snapback';
            return;
        }
        const isFreePlacement = !puzzle.isActive() && getBotLevel() === 0;
        if (event.target === 'offboard') {
            // In the editor a piece dragged off the board is removed
            if (isFreePlacement && event.source !== 'spare') session.applyEditedPosition(event);
            else event.action = 'snapback';
            return;
        }

        dragJustEnded = true;
        clearSelection();
        setTimeout(() => { dragJustEnded = false; }, CLICK_DEBOUNCE_MS);

        // A promotion waits for the piece choice: the pawn goes back until it is made
        if (event.source !== 'spare' && promotingColor(event.source, event.target) && typeof boardView.choosePromotion === 'function') {
            event.action = 'snapback';
            commitMove(event.source, event.target, event.piece);
            return;
        }

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
