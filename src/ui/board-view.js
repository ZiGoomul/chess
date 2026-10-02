import { getLegalMovesForSquare, getSquareFromCoords } from '../domain/move-input.js';

export function createBoardView({ $, eventBus, store }) {
    var board = null;
    var currentHints = {};

    function clearArrows() {
        var group = document.getElementById('arrowsGroup');
        if (group) group.innerHTML = '';
        $('#myBoard .square-55d63').removeClass('hint-square');
    }

    function getSquareCenter(square) {
        var squareEl = $('#myBoard .square-' + square);
        var overlayEl = $('#arrowOverlay');
        if (squareEl.length === 0 || overlayEl.length === 0) return { x: 0, y: 0 };

        var squareOffset = squareEl.offset();
        var overlayOffset = overlayEl.offset();
        return {
            x: squareOffset.left - overlayOffset.left + squareEl.outerWidth() / 2,
            y: squareOffset.top - overlayOffset.top + squareEl.outerHeight() / 2
        };
    }

    function drawArrow(source, target, multipv, game) {
        var p1 = getSquareCenter(source);
        var p2 = getSquareCenter(target);
        var piece = game ? game.get(source) : null;
        var isKnight = piece && piece.type === 'n';

        var sqSize = $('#myBoard').width() / 8;
        var shorten = sqSize * 0.35;

        var color, strokeWidth, markerId;
        if (multipv === 1) {
            color = "rgba(46, 204, 113, 0.8)"; // Green
            strokeWidth = sqSize * 0.15;
            markerId = "url(#arrowhead1)";
        } else if (multipv === 2) {
            color = "rgba(52, 152, 219, 0.8)"; // Blue
            strokeWidth = sqSize * 0.08;
            markerId = "url(#arrowhead2)";
        } else {
            color = "rgba(155, 89, 182, 0.8)"; // Purple
            strokeWidth = sqSize * 0.04;
            markerId = "url(#arrowhead3)";
        }

        var svgElem;
        
        if (isKnight) {
            var dx = p2.x - p1.x;
            var dy = p2.y - p1.y;
            var elbowX, elbowY;
            if (Math.abs(dx) > Math.abs(dy)) {
                elbowX = p2.x;
                elbowY = p1.y;
            } else {
                elbowX = p1.x;
                elbowY = p2.y;
            }
            
            var finalDist = Math.sqrt(Math.pow(p2.x - elbowX, 2) + Math.pow(p2.y - elbowY, 2));
            if (finalDist < shorten) shorten = finalDist * 0.5;
            
            var ratio = (finalDist - shorten) / finalDist;
            var finalX = elbowX + (p2.x - elbowX) * ratio;
            var finalY = elbowY + (p2.y - elbowY) * ratio;
            
            svgElem = document.createElementNS("http://www.w3.org/2000/svg", "path");
            var d = "M " + p1.x + " " + p1.y + " L " + elbowX + " " + elbowY + " L " + finalX + " " + finalY;
            svgElem.setAttribute("d", d);
            svgElem.setAttribute("fill", "none");
            svgElem.setAttribute("stroke-linejoin", "round");
            svgElem.setAttribute("stroke-linecap", "round");
        } else {
            var dx = p2.x - p1.x;
            var dy = p2.y - p1.y;
            var dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < shorten) shorten = dist * 0.5;
            
            var ratio = (dist - shorten) / dist;
            var finalX = p1.x + dx * ratio;
            var finalY = p1.y + dy * ratio;

            svgElem = document.createElementNS("http://www.w3.org/2000/svg", "line");
            svgElem.setAttribute("x1", p1.x);
            svgElem.setAttribute("y1", p1.y);
            svgElem.setAttribute("x2", finalX);
            svgElem.setAttribute("y2", finalY);
            svgElem.setAttribute("stroke-linecap", "round");
        }

        svgElem.setAttribute("stroke", color);
        svgElem.setAttribute("stroke-width", strokeWidth);
        svgElem.setAttribute("marker-end", markerId);
        
        var group = document.getElementById("arrowsGroup");
        if (group) group.appendChild(svgElem);
    }

    function removeHighlights() {
        $('#myBoard .square-55d63').css('background', '').removeClass('selected-square has-dest-marker');
        $('#myBoard .move-dest-marker').remove();
    }

    function showMoveHints(square, moves, positionGame) {
        removeHighlights();
        var $square = $('#myBoard .square-' + square);
        $square.addClass('selected-square');

        if (!$('#highlightMovesCb').is(':checked')) return;

        // If moves aren't passed, we need a game instance to compute them. 
        // We'll rely on the caller or emit an event to request moves if needed.
        if (moves) {
            var seenDest = {};
            for (var i = 0; i < moves.length; i++) {
                var dest = moves[i].to;
                if (seenDest[dest]) continue;
                seenDest[dest] = true;

                var isCapture = Boolean(positionGame && positionGame.get(dest)) || Boolean(moves[i].flags && moves[i].flags.indexOf('e') !== -1);
                var $destSq = $('#myBoard .square-' + dest);
                $destSq.addClass('has-dest-marker');
                $destSq.append('<div class="move-dest-marker' + (isCapture ? ' is-capture' : '') + '"></div>');
            }
        }
    }

    function highlightCheck(positionGame) {
        if (!positionGame) return;
        $('#myBoard .square-55d63').removeClass('in-check');
        if (positionGame.in_check() || positionGame.in_checkmate()) {
            var turn = positionGame.turn();
            var boardState = positionGame.board();
            var kingSquare = null;
            var files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            for (var r = 0; r < 8; r++) {
                for (var c = 0; c < 8; c++) {
                    var piece = boardState[r][c];
                    if (piece && piece.type === 'k' && piece.color === turn) {
                        kingSquare = files[c] + (8 - r);
                        break;
                    }
                }
            }
            if (kingSquare) {
                $('#myBoard .square-' + kingSquare).addClass('in-check');
            }
        }
    }

    function highlightAttackedPieces(positionGame) {
        if (!positionGame) return;
        $('#myBoard .square-55d63')
            .removeClass('attacked-by-white attacked-by-black defenders-badge')
            .removeAttr('data-attacks')
            .removeAttr('data-defenders');
            
        var showAttacks = $('#highlightAttacksCb').is(':checked');
        var showDefenses = $('#highlightDefensesCb').is(':checked');
        
        if (!showAttacks && !showDefenses) return;

        var position = positionGame;
        var fen = position.fen();
        var parts = fen.split(' ');
        
        var attackedByWhite = {};
        var attackedByBlack = {};

        function processMoves(moves) {
            for (var i = 0; i < moves.length; i++) {
                if (moves[i].captured) {
                    var sq = moves[i].to;
                    if (moves[i].color === 'w') {
                        attackedByWhite[sq] = (attackedByWhite[sq] || 0) + 1;
                    } else {
                        attackedByBlack[sq] = (attackedByBlack[sq] || 0) + 1;
                    }
                }
            }
        }
        
        if (showAttacks) {
            processMoves(position.moves({verbose: true}));
            var otherColor = parts[1] === 'w' ? 'b' : 'w';
            parts[1] = otherColor;
            parts[3] = '-'; 
            
            // To do this we need a Chess instance.
            // Ideally we pass Chess constructor or import it.
            if (window.Chess) {
                var tempGame = new window.Chess();
                if (tempGame.load(parts.join(' '))) {
                    processMoves(tempGame.moves({verbose: true}));
                }
            }
        }

        var defenders = {};
        if (showDefenses && window.Chess) {
            var boardState = position.board();
            var files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            var tempDefGame = new window.Chess();
            for (var r = 0; r < 8; r++) {
                for (var c = 0; c < 8; c++) {
                    var piece = boardState[r][c];
                    if (piece && piece.type !== 'k') { 
                        var sq = files[c] + (8 - r);
                        var enemyColor = piece.color === 'w' ? 'b' : 'w';
                        
                        tempDefGame.load(fen);
                        tempDefGame.put({ type: piece.type, color: enemyColor }, sq);
                        var partsTemp = tempDefGame.fen().split(' ');
                        partsTemp[1] = piece.color;
                        partsTemp[3] = '-';
                        
                        if (tempDefGame.load(partsTemp.join(' '))) {
                            var moves = tempDefGame.moves({ verbose: true });
                            var count = 0;
                            for (var i = 0; i < moves.length; i++) {
                                if (moves[i].to === sq) count++;
                            }
                            if (count > 0) {
                                defenders[sq] = count;
                            }
                        }
                    }
                }
            }
        }
        
        if (showAttacks) {
            for (var sq in attackedByWhite) {
                $('#myBoard .square-' + sq)
                    .addClass('attacked-by-white')
                    .attr('data-attacks', attackedByWhite[sq]);
            }
            for (var sq in attackedByBlack) {
                $('#myBoard .square-' + sq)
                    .addClass('attacked-by-black')
                    .attr('data-attacks', attackedByBlack[sq]);
            }
        }
        
        if (showDefenses) {
            for (var sq in defenders) {
                $('#myBoard .square-' + sq)
                    .addClass('defenders-badge')
                    .attr('data-defenders', defenders[sq]);
            }
        }
    }

    function getPieceThemeUrl(piece) {
        var theme = $('#pieceThemeSelect').val() || 'wikipedia';
        if (theme === 'wikipedia') {
            return 'https://chessboardjs.com/img/chesspieces/wikipedia/' + piece + '.png';
        } else if (theme.startsWith('chesscom_')) {
            var chesscomTheme = theme.split('_')[1];
            return 'https://images.chesscomfiles.com/chess-themes/pieces/' + chesscomTheme + '/150/' + piece.toLowerCase() + '.png';
        } else {
            return 'https://lichess1.org/assets/piece/' + theme + '/' + piece + '.svg';
        }
    }

    function getSquareAtPoint(clientX, clientY) {
        var el = document.elementFromPoint(clientX, clientY);
        if (el) {
            var $sq = $(el).closest('.square-55d63');
            if ($sq.length) {
                var sq = $sq.attr('data-square') || ($sq.attr('class') || '').match(/square-([a-h][1-8])/)?.[1];
                if (sq) return sq;
            }
        }
        var boardEl = $('#myBoard .board-b72b1')[0] || $('#myBoard')[0];
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
        var config = {
            draggable: true,
            dropOffBoard: 'trash',
            sparePieces: true,
            position: 'start',
            pieceTheme: getPieceThemeUrl,
            onDragStart: function(source, piece, position, orientation) {
                var event = { source, piece, position, orientation, cancel: false };
                eventBus.emit('board:drag-start', event);
                if (event.cancel) return false;
            },
            onDrop: function(source, target, piece, newPos, oldPos, orientation) {
                var event = { source, target, piece, newPos, oldPos, orientation, action: null };
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
                eventBus.emit('board:snap-end');
            }
        };
        board = Chessboard('myBoard', config);

        var downTrackInfo = null;
        $(document).on('pointerdown mousedown touchstart', function(e) {
            if (e.button !== undefined && e.button !== 0 && e.type === 'mousedown') return;
            var clientX = e.clientX ?? e.originalEvent?.touches?.[0]?.clientX;
            var clientY = e.clientY ?? e.originalEvent?.touches?.[0]?.clientY;
            if (clientX === undefined || clientY === undefined) return;

            var boardEl = $('#myBoard .board-b72b1')[0] || $('#myBoard')[0];
            if (!boardEl) return;
            var rect = boardEl.getBoundingClientRect();

            if (clientX >= rect.left - 4 && clientX <= rect.right + 4 &&
                clientY >= rect.top - 4 && clientY <= rect.bottom + 4) {
                downTrackInfo = { x: clientX, y: clientY, time: Date.now() };
            } else {
                downTrackInfo = null;
                var isPiece = $(e.target).closest('.piece-417db').length > 0;
                eventBus.emit('board:pointer-down-outside', { isPiece });
            }
        });

        $(document).on('pointerup mouseup touchend', function(e) {
            if (!downTrackInfo) return;
            var clientX = e.clientX ?? e.originalEvent?.changedTouches?.[0]?.clientX;
            var clientY = e.clientY ?? e.originalEvent?.changedTouches?.[0]?.clientY;
            if (clientX === undefined || clientY === undefined) return;

            var dx = Math.abs(clientX - downTrackInfo.x);
            var dy = Math.abs(clientY - downTrackInfo.y);
            var elapsed = Date.now() - downTrackInfo.time;
            downTrackInfo = null;

            if (dx < 24 && dy < 24 && elapsed < 750) {
                var square = getSquareAtPoint(clientX, clientY);
                if (square) {
                    eventBus.emit('board:square-clicked', { square });
                }
            }
        });

        $('#myBoard').on('click', '.square-55d63', function() {
            var square = $(this).attr('data-square') || ($(this).attr('class') || '').match(/square-([a-h][1-8])/)?.[1];
            if (square) {
                eventBus.emit('board:square-clicked', { square });
            }
        });

        eventBus.on('game:move-made', function(data) {
             if (board && data.fen) {
                 board.position(data.fen, false);
             }
        });

        eventBus.on('engine:hints-updated', function(data) {
             clearArrows();
             if (data && data.hints && data.game) {
                 for (var i = 3; i >= 1; i--) {
                     if (data.hints[i]) {
                         var from = data.hints[i].substring(0, 2);
                         var to = data.hints[i].substring(2, 4);
                         drawArrow(from, to, i, data.game);
                     }
                 }
             }
        });

        eventBus.on('board:orientation-changed', function(data) {
             if (board && data.color) {
                 board.orientation(data.color);
             }
        });

        eventBus.on('settings:changed', function(data) {
             if (data.pieceTheme && board) {
                 var currentFen = board.fen();
                 var currentOrientation = board.orientation();
                 board.destroy();
                 config.position = currentFen;
                 config.orientation = currentOrientation;
                 board = Chessboard('myBoard', config);
             }
        });

        $(window).resize(function() {
            if (board) board.resize();
        });
    }

    initBoard();

    return {
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
        showMoveHints: showMoveHints,
        removeHighlights: removeHighlights,
        highlightCheck: highlightCheck,
        highlightAttackedPieces: highlightAttackedPieces
    };
}
