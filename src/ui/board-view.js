import { getSquareFromCoords } from '../domain/move-input.js';
import { getKingSquareInCheck } from '../domain/check-state.js';
import { MOVE_CLASS_LABELS } from './move-classes.js';
import { pieceImageUrl, LOCAL_PIECE_THEME } from './piece-images.js';
import { isGuidedMode } from '../domain/position.js';
import { computeHighlights, extractPiecesFromGame } from '../domain/attack-map.js';

export function createBoardView({ $, eventBus, store }) {
    let board = null;
    let currentCheckGame = null;
    let currentLastMove = null;
    let currentFeedback = null;
    let lastPointerUpSquareTime = 0;

    function clearArrows() {
        const group = document.getElementById('arrowsGroup');
        if (group) group.innerHTML = '';
    }

    function getSquareCenter(square) {
        let squareEl = $('#myBoard [data-square="' + square + '"]');
        if (!squareEl.length) {
            squareEl = $('#myBoard .square-' + square);
        }
        const overlayEl = $('#arrowOverlay');
        if (!squareEl.length || !overlayEl.length) return { x: 0, y: 0 };

        const squareOffset = squareEl.offset();
        const overlayOffset = overlayEl.offset();
        if (!squareOffset || !overlayOffset) return { x: 0, y: 0 };

        return {
            x: squareOffset.left - overlayOffset.left + squareEl.outerWidth() / 2,
            y: squareOffset.top - overlayOffset.top + squareEl.outerHeight() / 2
        };
    }

    function drawArrow(source, target, multipv, game) {
        const p1 = getSquareCenter(source);
        const p2 = getSquareCenter(target);
        if ((!p1.x && !p1.y) || (!p2.x && !p2.y)) return;

        const piece = game ? game.get(source) : null;
        const isKnight = piece && piece.type === 'n';

        const sqSize = $('#myBoard').width() / 8;
        const shorten = sqSize * 0.35;

        // One orange family: the best move bold, the alternatives fainter and thinner
        let color, strokeWidth, markerId;
        if (multipv === 'guide') {
            // Lessons: the move to play, in green
            color = "rgba(129, 182, 76, 0.9)";
            strokeWidth = sqSize * 0.16;
            markerId = "url(#arrowheadGuide)";
        } else if (multipv === 1) {
            color = "rgba(255, 170, 0, 0.85)";
            strokeWidth = sqSize * 0.15;
            markerId = "url(#arrowhead1)";
        } else if (multipv === 2) {
            color = "rgba(255, 170, 0, 0.5)";
            strokeWidth = sqSize * 0.1;
            markerId = "url(#arrowhead2)";
        } else {
            color = "rgba(255, 170, 0, 0.32)";
            strokeWidth = sqSize * 0.07;
            markerId = "url(#arrowhead3)";
        }

        let svgElem;
        
        if (isKnight) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            let elbowX, elbowY;
            if (Math.abs(dx) > Math.abs(dy)) {
                elbowX = p2.x;
                elbowY = p1.y;
            } else {
                elbowX = p1.x;
                elbowY = p2.y;
            }
            
            const finalDist = Math.sqrt(Math.pow(p2.x - elbowX, 2) + Math.pow(p2.y - elbowY, 2));
            const actualShorten = finalDist < shorten ? finalDist * 0.5 : shorten;
            
            const ratio = (finalDist - actualShorten) / finalDist;
            const finalX = elbowX + (p2.x - elbowX) * ratio;
            const finalY = elbowY + (p2.y - elbowY) * ratio;
            
            svgElem = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const d = "M " + p1.x + " " + p1.y + " L " + elbowX + " " + elbowY + " L " + finalX + " " + finalY;
            svgElem.setAttribute("d", d);
            svgElem.setAttribute("fill", "none");
            svgElem.setAttribute("stroke-linejoin", "round");
            svgElem.setAttribute("stroke-linecap", "round");
        } else {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const actualShorten = dist < shorten ? dist * 0.5 : shorten;
            
            const ratio = (dist - actualShorten) / dist;
            const lineEndX = p1.x + dx * ratio;
            const lineEndY = p1.y + dy * ratio;

            svgElem = document.createElementNS("http://www.w3.org/2000/svg", "line");
            svgElem.setAttribute("x1", p1.x);
            svgElem.setAttribute("y1", p1.y);
            svgElem.setAttribute("x2", lineEndX);
            svgElem.setAttribute("y2", lineEndY);
            svgElem.setAttribute("stroke-linecap", "round");
        }

        svgElem.setAttribute("stroke", color);
        svgElem.setAttribute("stroke-width", strokeWidth);
        svgElem.setAttribute("marker-end", markerId);
        
        const group = document.getElementById("arrowsGroup");
        if (group) group.appendChild(svgElem);
    }

    function showGuideArrow(from, to, game) {
        clearArrows();
        drawArrow(from, to, 'guide', game);
    }

    function highlightLastMove(from, to) {
        currentLastMove = (from && to) ? { from: from, to: to } : null;
        $('#myBoard .square-55d63').removeClass('last-move-highlight');
        if (from) {
            $('#myBoard [data-square="' + from + '"], #myBoard .square-' + from).addClass('last-move-highlight');
        }
        if (to) {
            $('#myBoard [data-square="' + to + '"], #myBoard .square-' + to).addClass('last-move-highlight');
        }
    }

    function clearMoveClass() {
        $('#myBoard .board-move-class').remove();
    }

    // Review badge in the corner of a square (★, ?!, ?? …)
    function showMoveClass(square, cls) {
        clearMoveClass();
        const label = MOVE_CLASS_LABELS[cls];
        const squareEl = $('#myBoard [data-square="' + square + '"]');
        if (!label || !squareEl.length) return;
        squareEl.first().append(
            $('<span class="board-move-class" aria-hidden="true"></span>').addClass('move-class--' + cls).attr('title', label.label).text(label.icon)
        );
    }

    const PROMOTION_PIECES = [
        { type: 'q', label: 'Ферзь' },
        { type: 'r', label: 'Ладья' },
        { type: 'b', label: 'Слон' },
        { type: 'n', label: 'Конь' }
    ];
    let resolvePromotion = null;

    function closePromotion(choice) {
        $('.promotion-layer').remove();
        $(document).off('keydown.promotion');
        if (resolvePromotion) {
            const resolve = resolvePromotion;
            resolvePromotion = null;
            resolve(choice);
        }
    }

    /**
     * Shows the four pieces in a column on the promotion square's file, growing from the
     * square towards the middle of the board. Resolves to q / r / b / n, or null if cancelled.
     */
    function choosePromotion(square, color) {
        closePromotion(null);
        const squareEl = $('#myBoard [data-square="' + square + '"]').first();
        const stage = $('#myBoard').closest('.board-stage');
        if (!squareEl.length || !stage.length) return Promise.resolve('q');

        const size = squareEl.outerWidth();
        const squareOffset = squareEl.offset();
        const stageOffset = stage.offset();
        const left = squareOffset.left - stageOffset.left;
        const top = squareOffset.top - stageOffset.top;
        const downward = top + size / 2 < stage.height() / 2;

        const layer = $('<div class="promotion-layer"></div>');
        const picker = $('<div class="promotion-picker" role="dialog" aria-label="Выберите фигуру для превращения"></div>')
            .toggleClass('promotion-picker--up', !downward)
            .css({ left: left, width: size, top: downward ? top : 'auto', bottom: downward ? 'auto' : stage.height() - top - size });

        PROMOTION_PIECES.forEach(function(option) {
            $('<button type="button" class="promotion-option"></button>')
                .attr('aria-label', option.label)
                .css({ width: size, height: size })
                .append($('<img alt="">').attr('src', getPieceThemeUrl(color + option.type.toUpperCase())))
                .on('click', function(event) { event.stopPropagation(); closePromotion(option.type); })
                .appendTo(picker);
        });
        $('<button type="button" class="promotion-cancel" aria-label="Отменить превращение">✕</button>')
            .on('click', function(event) { event.stopPropagation(); closePromotion(null); })
            .appendTo(picker);

        layer.on('click', function(event) { if (event.target === layer[0]) closePromotion(null); });
        layer.append(picker).appendTo(stage);
        $(document).on('keydown.promotion', function(event) {
            if (event.key === 'Escape') closePromotion(null);
        });
        picker.find('.promotion-option').first().trigger('focus');

        return new Promise(function(resolve) { resolvePromotion = resolve; });
    }

    function clearSquareFeedback() {
        currentFeedback = null;
        $('#myBoard .square-feedback-badge').remove();
        $('#myBoard .square-55d63').removeClass('square-feedback--correct square-feedback--wrong');
    }

    // Puzzle feedback on the destination square: kind is 'correct' (✓) or 'wrong' (✗)
    function showSquareFeedback(square, kind) {
        clearSquareFeedback();
        const squareEl = $('#myBoard [data-square="' + square + '"]').first();
        if (!squareEl.length) return;
        currentFeedback = { square: square, kind: kind };
        squareEl.addClass('square-feedback--' + kind).append(
            $('<span class="square-feedback-badge" aria-hidden="true"></span>')
                .addClass('square-feedback-badge--' + kind)
                .text(kind === 'correct' ? '✓' : '✗')
        );
    }

    // chessboard.js rebuilds the squares on resize and orientation change; put the marks back
    function restoreSquareMarks() {
        if (currentLastMove) highlightLastMove(currentLastMove.from, currentLastMove.to);
        if (currentCheckGame) highlightCheck(currentCheckGame);
        if (currentFeedback) showSquareFeedback(currentFeedback.square, currentFeedback.kind);
    }

    function clearLastMoveHighlight() {
        currentLastMove = null;
        $('#myBoard .square-55d63').removeClass('last-move-highlight');
    }

    function removeHighlights() {
        $('#myBoard .square-55d63').removeClass('selected-square has-dest-marker');
        $('#myBoard .move-dest-marker').remove();
    }

    function showMoveHints(square, destinations) {
        removeHighlights();
        $('#myBoard .square-' + square).addClass('selected-square');

        const stateSettings = store && store.getState ? store.getState().settings : null;
        const showMoves = stateSettings ? stateSettings.highlightMoves : $('#highlightMovesCb').is(':checked');
        if (!showMoves) return;

        (destinations || []).forEach(function(dest) {
            const $destSq = $('#myBoard .square-' + dest.square);
            $destSq.addClass('has-dest-marker');
            $destSq.append('<div class="move-dest-marker' + (dest.isCapture ? ' is-capture' : '') + '"></div>');
        });
    }

    function highlightCheck(positionGame) {
        currentCheckGame = positionGame || (store && store.getState ? store.getState().game : null);
        $('#myBoard .square-55d63').removeClass('in-check');
        if (!currentCheckGame) return;

        const kingSquare = getKingSquareInCheck(currentCheckGame);
        if (kingSquare) {
            $('#myBoard [data-square="' + kingSquare + '"], #myBoard .square-' + kingSquare).addClass('in-check');
        }
    }

    function highlightAttackedPieces(positionGame) {
        if (!positionGame) return;
        $('#myBoard .square-55d63')
            .removeClass('attacked-by-white attacked-by-black defenders-badge')
            .removeAttr('data-attacks')
            .removeAttr('data-defenders');
            
        // A rated game with help switched off hides them without touching the settings
        const assistsOff = Boolean(store && store.getState().assistsOff);
        const storeSettings = store && store.getState ? store.getState().settings : null;
        const showAttacks = !assistsOff && (storeSettings ? storeSettings.highlightAttacks : $('#highlightAttacksCb').is(':checked'));
        const showDefenses = !assistsOff && (storeSettings ? storeSettings.highlightDefenses : $('#highlightDefensesCb').is(':checked'));
        
        if (!showAttacks && !showDefenses) return;

        const pieces = extractPiecesFromGame(positionGame);
        const { attacks, defenders } = computeHighlights(pieces);

        if (showAttacks) {
            for (const sq in attacks) {
                const info = attacks[sq];
                $('#myBoard .square-' + sq)
                    .addClass(info.by === 'w' ? 'attacked-by-white' : 'attacked-by-black')
                    .attr('data-attacks', info.count);
            }
        }

        if (showDefenses) {
            for (const sq in defenders) {
                $('#myBoard .square-' + sq)
                    .addClass('defenders-badge')
                    .attr('data-defenders', defenders[sq]);
            }
        }
    }

    function getPieceThemeUrl(piece) {
        return pieceImageUrl($('#pieceThemeSelect').val() || LOCAL_PIECE_THEME, piece);
    }

    function getSquareAtPoint(clientX, clientY) {
        const el = document.elementFromPoint(clientX, clientY);
        if (el) {
            const $sq = $(el).closest('.square-55d63');
            if ($sq.length) {
                const sq = $sq.attr('data-square') || ($sq.attr('class') || '').match(/square-([a-h][1-8])/)?.[1];
                if (sq) return sq;
            }
        }
        const boardEl = $('#myBoard .board-b72b1')[0] || $('#myBoard')[0];
        if (boardEl && board) {
            return getSquareFromCoords({
                clientX: clientX,
                clientY: clientY,
                rect: boardEl.getBoundingClientRect(),
                orientation: board.orientation()
            });
        }
        return null;
    }

    function initBoard() {
        const config = {
            draggable: true,
            dropOffBoard: 'trash',
            sparePieces: true,
            position: 'start',
            pieceTheme: getPieceThemeUrl,
            moveSpeed: 240,
            snapSpeed: 60,
            snapbackSpeed: 60,
            onDragStart: function(source, piece, position, orientation) {
                const event = { source, piece, position, orientation, cancel: false };
                eventBus.emit('board:drag-start', event);
                if (event.cancel) return false;
            },
            onDrop: function(source, target, piece, newPos, oldPos, orientation) {
                const event = { source, target, piece, newPos, oldPos, orientation, action: null };
                eventBus.emit('board:drop', event);
                if (event.action === 'snapback') return 'snapback';
            },
            onMouseoutSquare: function(square, piece) {
                eventBus.emit('board:mouseout-square', { square, piece });
            },
            onMouseoverSquare: function(square, piece) {
                eventBus.emit('board:mouseover-square', { square, piece });
            },
            onSnapEnd: function() {
                const state = store ? store.getState() : null;
                const currentFen = state && state.historyFENs && typeof state.currentViewPly === 'number' 
                    ? state.historyFENs[state.currentViewPly] 
                    : (state && state.game ? state.game.fen() : null);
                if (board && currentFen) {
                    board.position(currentFen, false);
                }
                if (currentLastMove) {
                    highlightLastMove(currentLastMove.from, currentLastMove.to);
                }
                if (currentCheckGame) {
                    highlightCheck(currentCheckGame);
                }
                eventBus.emit('board:snap-end');
            }
        };
        board = Chessboard('myBoard', config);

        let downTrackInfo = null;
        $(document).on('pointerdown mousedown touchstart', function(e) {
            if (e.button !== undefined && e.button !== 0 && e.type === 'mousedown') return;
            // The promotion picker handles its own clicks
            if ($(e.target).closest('.promotion-layer').length) { downTrackInfo = null; return; }
            const clientX = e.clientX ?? e.originalEvent?.touches?.[0]?.clientX;
            const clientY = e.clientY ?? e.originalEvent?.touches?.[0]?.clientY;
            if (clientX === undefined || clientY === undefined) return;

            const boardEl = $('#myBoard .board-b72b1')[0] || $('#myBoard')[0];
            if (!boardEl) return;
            const rect = boardEl.getBoundingClientRect();

            if (clientX >= rect.left - 4 && clientX <= rect.right + 4 &&
                clientY >= rect.top - 4 && clientY <= rect.bottom + 4) {
                downTrackInfo = { x: clientX, y: clientY, time: Date.now() };
            } else {
                downTrackInfo = null;
                const isPiece = $(e.target).closest('.piece-417db').length > 0;
                eventBus.emit('board:pointer-down-outside', { isPiece });
            }
        });

        $(document).on('pointerup mouseup touchend', function(e) {
            if (!downTrackInfo) return;
            const clientX = e.clientX ?? e.originalEvent?.changedTouches?.[0]?.clientX;
            const clientY = e.clientY ?? e.originalEvent?.changedTouches?.[0]?.clientY;
            if (clientX === undefined || clientY === undefined) return;

            const dx = Math.abs(clientX - downTrackInfo.x);
            const dy = Math.abs(clientY - downTrackInfo.y);
            const elapsed = Date.now() - downTrackInfo.time;
            downTrackInfo = null;

            if (dx < 24 && dy < 24 && elapsed < 750) {
                const square = getSquareAtPoint(clientX, clientY);
                if (square) {
                    lastPointerUpSquareTime = Date.now();
                    eventBus.emit('board:square-clicked', { square });
                }
            }
        });

        $('#myBoard').on('click', '.square-55d63', function() {
            if (Date.now() - lastPointerUpSquareTime < 400) return;
            const square = $(this).attr('data-square') || ($(this).attr('class') || '').match(/square-([a-h][1-8])/)?.[1];
            if (square) {
                eventBus.emit('board:square-clicked', { square });
            }
        });

        eventBus.on('game:move-made', function(data) {
             if (board && data.fen) {
                 const useAnimation = data.animate !== undefined ? data.animate : true;
                 board.position(data.fen, useAnimation);
                 if (data.move && data.move.from && data.move.to) {
                     highlightLastMove(data.move.from, data.move.to);
                 }
                 const checkGame = data.game || (store && store.getState ? store.getState().game : currentCheckGame);
                 if (checkGame) {
                     highlightCheck(checkGame);
                 }
             }
        });

        eventBus.on('engine:hints-updated', function(data) {
             clearArrows();
             // No engine arrows while solving a puzzle or in a lesson
             if (!data || (store && isGuidedMode(store.getState().mode))) return;
             const game = data.game || (store && store.getState ? store.getState().game : null);
             if (data.hints) {
                 for (let i = 3; i >= 1; i--) {
                     if (data.hints[i]) {
                         const from = data.hints[i].substring(0, 2);
                         const to = data.hints[i].substring(2, 4);
                         drawArrow(from, to, i, game);
                     }
                 }
             } else if (data.arrows && Array.isArray(data.arrows)) {
                 for (let a = 0; a < data.arrows.length; a++) {
                     const arr = data.arrows[a];
                     drawArrow(arr.from, arr.to, arr.rank, game);
                 }
             }
        });

        eventBus.on('board:orientation-changed', function(data) {
             const color = data && (data.orientation || data.color);
             if (board && color) {
                 board.orientation(color);
                 restoreSquareMarks();
             }
        });

        eventBus.on('settings:changed', function(data) {
             if (data.pieceTheme && board) {
                 const currentFen = board.fen();
                 const currentOrientation = board.orientation();
                 board.destroy();
                 config.position = currentFen;
                 config.orientation = currentOrientation;
                 board = Chessboard('myBoard', config);
                 restoreSquareMarks();
                 if (currentCheckGame) highlightAttackedPieces(currentCheckGame);
                 eventBus.emit('board:resized');
             }
        });

        $(window).resize(function() {
            if (board) {
                board.resize();
                restoreSquareMarks();
                setTimeout(function() {
                    eventBus.emit('board:resized');
                }, 100);
            }
        });
    }

    initBoard();

    return {
        position: function(fen, useAnimation) {
            if (board) {
                if (fen === undefined) return board.position();
                return board.position(fen, useAnimation !== undefined ? useAnimation : true);
            }
        },
        setFen: function(fen) { if (board) board.position(fen); },
        getFen: function() { return board ? board.fen() : null; },
        orientation: function(color) { 
            if (board) {
                if (color) { board.orientation(color); return this; }
                return board.orientation();
            }
        },
        clear: function() { if (board) board.clear(); },
        start: function() { if (board) board.start(); },
        flip: function() { if (board) board.flip(); },
        resize: function() { if (board) board.resize(); },
        destroy: function() { if (board) board.destroy(); },
        clearArrows: clearArrows,
        showGuideArrow: showGuideArrow,
        showMoveHints: showMoveHints,
        removeHighlights: removeHighlights,
        highlightLastMove: highlightLastMove,
        clearLastMoveHighlight: clearLastMoveHighlight,
        showMoveClass: showMoveClass,
        showSquareFeedback: showSquareFeedback,
        choosePromotion: choosePromotion,
        clearSquareFeedback: clearSquareFeedback,
        clearMoveClass: clearMoveClass,
        highlightCheck: highlightCheck,
        highlightAttackedPieces: highlightAttackedPieces
    };
}
