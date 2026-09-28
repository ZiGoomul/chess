import { createAudio } from '../services/audio.js';
import { createClock } from '../services/clock.js';
import { createEngineWorkers } from '../services/engine-workers.js';
import { createChessEngine } from '../services/chess-engine';
import { puzzleDatabase } from '../data/puzzles.js';
import { createMoveHistoryView } from '../ui/move-history.js';
import { retainCastlingRights } from '../domain/castling-rights.js';

$(document).ready(function() {
    var board = null;
    var game = new Chess();
    var historyFENs = [game.fen()];
    var currentViewPly = 0;

    // --- Режим задач ---
    var isPuzzleMode = false;
    var currentPuzzle = null;
    var currentPuzzleStep = 0;
    var solvedPuzzlesCount = 0;

    // --- Часы ---
    
    var engineWorkers = createEngineWorkers();

    var audio = createAudio(game);
    var playSound = audio.playSound;
    var playSoundForMove = audio.playSoundForMove;

    var clock = createClock({
        $: $,
        game: game,
        getBoard: function() { return board; },
        getIsPuzzleMode: function() { return isPuzzleMode; },
        getCurrentViewPly: function() { return currentViewPly; },
        getHistoryLength: function() { return historyFENs.length; },
        playSound: playSound
    });
    var moveHistoryView = createMoveHistoryView({
        $: $,
        game: game,
        getBoard: function() { return board; },
        getHistoryFENs: function() { return historyFENs; },
        getCurrentViewPly: function() { return currentViewPly; },
        setCurrentViewPly: function(ply) { currentViewPly = ply; },
        clearArrows: clearArrows,
        onPositionChange: function() { updateStatus(false); }
    });
    
    var currentHints = {};

    var engine = createChessEngine({
        gameWorker: engineWorkers.game,
        hintWorker: engineWorkers.hints,
        getCurrentFen: function() { return game.fen(); },
        onBotMove: function(move) {
            if (!move) {
                updateStatus();
                return;
            }

            var botMove = game.move(move);
            if (!botMove) {
                updateStatus();
                return;
            }

            historyFENs.push(game.fen());
            currentViewPly = historyFENs.length - 1;
            playSoundForMove(botMove);
            clock.addIncrement(botMove.color);
            clock.startClock();
            board.position(game.fen());
            updateStatus();
            autoHintIfNeeded();
        },
        onBotThinkingChange: function() { updateStatus(); },
        onHint: function(info) {
            currentHints[info.multipv] = info.move;
            if (info.multipv === 1) {
                if (info.cp !== null) updateEvalBar(info.cp, null);
                else if (info.mate !== null) updateEvalBar(null, info.mate);
            }
        },
        onHintComplete: function() {
            drawHintArrows();
            $('#hintBtn').text('Подсказать лучший ход').prop('disabled', false);
        }
    });

    function cancelBotSearch() {
        engine.cancelBotMove();
    }

    function updateStockfishLevel() {
        engine.setBotLevel(parseInt($('#botLevel').val(), 10));
    }

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

    function drawArrow(source, target, multipv) {
        var p1 = getSquareCenter(source);
        var p2 = getSquareCenter(target);
        var piece = game.get(source);
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
            // У коня длинная часть буквы Г может быть по горизонтали или вертикали
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

    function drawHintArrows() {
        clearArrows();
        // Draw reverse order so best move is drawn last (on top)
        for (var i = 3; i >= 1; i--) {
            if (currentHints[i]) {
                var from = currentHints[i].substring(0, 2);
                var to = currentHints[i].substring(2, 4);
                drawArrow(from, to, i);
            }
        }
    }

    function requestHint() {
        if (game.game_over()) return;
        
        var level = parseInt($('#hintLevel').val(), 10);
        $('#hintBtn').text('Анализ...').prop('disabled', true);
        
        clearArrows();
        currentHints = {};
        engine.requestHint(game.fen(), level);
    }

    $('#hintBtn').on('click', function() {
        requestHint();
    });

    function autoHintIfNeeded() {
        if ($('#autoHintCb').is(':checked') && !game.game_over()) {
            var botLevel = parseInt($('#botLevel').val(), 10);
            if (botLevel > 0) {
                // В режиме игры запрашиваем подсказку только в свой ход
                var isPlayerTurn = (board.orientation() === 'white' && game.turn() === 'w') || 
                                   (board.orientation() === 'black' && game.turn() === 'b');
                if (isPlayerTurn) {
                    requestHint();
                }
            } else {
                // В режиме редактора запрашиваем в любой момент после изменения позиции
                requestHint();
            }
        }
    }

    $('#autoHintCb').on('change', function() {
        autoHintIfNeeded();
    });

    function makeBotMove() {
        var level = parseInt($('#botLevel').val(), 10);
        if (level === 0 || game.game_over()) return;

        engine.requestBotMove(game.fen(), level);
    }

    // --- Подсветка ходов ---
    function removeHighlights() {
        $('#myBoard .square-55d63').css('background', '');
    }

    function highlightSquare(square) {
        var $square = $('#myBoard .square-' + square);
        var bg = '#cdd26a'; // Цвет для белых полей (подсветка)
        if ($square.hasClass('black-3c85d')) {
            bg = '#aaa23a'; // Цвет для черных полей
        }
        $square.css('background', bg);
    }

    // --- Обработчики доски (Chessboard.js) ---
    function loadRandomPuzzle() {
        cancelBotSearch();
        var randIdx = Math.floor(Math.random() * puzzleDatabase.length);
        currentPuzzle = puzzleDatabase[randIdx];
        currentPuzzleStep = 0;
        isPuzzleMode = true;
        
        game.load(currentPuzzle.fen);
        board.position(game.fen());
        historyFENs = [game.fen()];
        currentViewPly = 0;
        
        // Поворачиваем доску нужной стороной
        if (game.turn() === 'w') {
            board.orientation('white');
        } else {
            board.orientation('black');
        }
        
        var moveColor = (game.turn() === 'w') ? 'Белые' : 'Черные';
        $('#puzzleStatusText').text('Ход: ' + moveColor + '. Ваш ход!');
        $('#puzzleStatusText').css('color', 'var(--text-color)');
        $('#puzzleDescText').text(currentPuzzle.desc);
        
        moveHistoryView.updateMoveHistory();
        clearArrows();
    }

    function exitPuzzleMode() {
        isPuzzleMode = false;
        currentPuzzle = null;
        $('#puzzleStatusText').text('Нажмите "Новая задача", чтобы начать!');
        $('#puzzleDescText').text('');
        $('#startPositionBtn').click(); // Возвращаемся в обычную игру
    }

    function playOpponentPuzzleMove() {
        if (!isPuzzleMode || currentPuzzleStep >= currentPuzzle.moves.length) return;
        
        var oppMoveSAN = currentPuzzle.moves[currentPuzzleStep];
        var moveObj = game.move(oppMoveSAN);
        board.position(game.fen());
        playSoundForMove(moveObj);
        historyFENs.push(game.fen());
        currentViewPly = historyFENs.length - 1;
        moveHistoryView.updateMoveHistory();
        
        currentPuzzleStep++;
        
        if (currentPuzzleStep >= currentPuzzle.moves.length) {
            puzzleCompleted();
        } else {
            $('#puzzleStatusText').text('Ваш ход!');
            $('#puzzleStatusText').css('color', 'var(--text-color)');
        }
    }

    function puzzleCompleted() {
        solvedPuzzlesCount++;
        $('#puzzlesScore').text('Решено: ' + solvedPuzzlesCount);
        $('#puzzleStatusText').text('ЗАДАЧА РЕШЕНА! 🎉');
        $('#puzzleStatusText').css('color', '#2ecc71');
        playSound('gameEnd');
    }

    function onDragStart(source, piece, position, orientation) {
        if (engine.isThinking) return false;
        
        // В режиме задач запрещаем двигать фигуры, если задача решена
        if (isPuzzleMode && currentPuzzle && currentPuzzleStep >= currentPuzzle.moves.length) {
            return false;
        }
        // Запрещаем брать фигуры противника (кроме редактора — там можно двигать обе стороны)
        var isEditor = !isPuzzleMode && parseInt($('#botLevel').val(), 10) === 0;
        if (!isEditor) {
            if (game.turn() === 'w' && piece.search(/^b/) !== -1) return false;
            if (game.turn() === 'b' && piece.search(/^w/) !== -1) return false;
        }

        clearArrows();

        // Branching logic: if we are viewing the past and start moving, truncate the future
        if (currentViewPly < historyFENs.length - 1) {
            while (historyFENs.length - 1 > currentViewPly) {
                game.undo();
                historyFENs.pop();
            }
            moveHistoryView.updateMoveHistory();
            updateStatus();
        }
        
        var botLevel = parseInt($('#botLevel').val(), 10);
        
        if (botLevel > 0) {
            // В режиме игры запрещаем двигать фигуры, если игра окончена
            if (game.game_over()) return false;
            // В режиме игры запрещаем брать запасные фигуры
            if (source === 'spare') return false;
            // Запрет перемещения чужих фигур
            if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
                (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
                return false;
            }
        }
    }

    function onDrop(source, target, piece, newPos, oldPos, orientation) {
        if (isPuzzleMode && currentPuzzle) {
            // Проверка хода задачи
            var expectedMoveSAN = currentPuzzle.moves[currentPuzzleStep];
            
            // Пытаемся сделать ход, чтобы получить его SAN (чисто для проверки)
            var tempGame = new Chess(game.fen());
            var testMove = tempGame.move({ from: source, to: target, promotion: 'q' });
            
            if (testMove && testMove.san === expectedMoveSAN) {
                // Ход правильный!
                var move = game.move({ from: source, to: target, promotion: 'q' });
                board.position(game.fen());
                historyFENs.push(game.fen());
                currentViewPly = historyFENs.length - 1;
                playSoundForMove(move);
                moveHistoryView.updateMoveHistory();
                
                currentPuzzleStep++;
                
                if (currentPuzzleStep >= currentPuzzle.moves.length) {
                    puzzleCompleted();
                } else {
                    $('#puzzleStatusText').text('Верно! Ожидание хода противника...');
                    $('#puzzleStatusText').css('color', '#3498db');
                    setTimeout(playOpponentPuzzleMove, 600);
                }
            } else {
                // Ход неправильный
                $('#puzzleStatusText').text('Неверный ход! Попробуйте еще раз.');
                $('#puzzleStatusText').css('color', '#e74c3c');
                playSound('check'); // Используем звук шаха как ошибку
                return 'snapback';
            }
            return;
        }

        var botLevel = parseInt($('#botLevel').val(), 10);
        
        clearArrows();
        currentHints = {};
        
        if (botLevel === 0) {
            // In the editor, validate legal moves for the color of the moved piece,
            // even when that color is not the side to move in the current FEN.
            if (source !== 'spare' && target !== 'offboard' && source !== target) {
                var editorColor = piece.charAt(0);
                var isEditorOutOfTurn = game.turn() !== editorColor;
                var editorBaseFen = game.fen();
                var editorMove = null;

                if (isEditorOutOfTurn) {
                    var editorFenParts = editorBaseFen.split(' ');
                    editorFenParts[1] = editorColor;
                    var editorPosition = new Chess(editorFenParts.join(' '));
                    editorMove = editorPosition.move({ from: source, to: target, promotion: 'q' });

                    if (editorMove) {
                        game.load(editorFenParts.join(' '));
                        editorMove = game.move({ from: source, to: target, promotion: 'q' });
                        historyFENs = [editorFenParts.join(' ')];
                    }
                } else {
                    editorMove = game.move({ from: source, to: target, promotion: 'q' });
                }

                if (editorMove) {
                    historyFENs.push(game.fen());
                    currentViewPly = historyFENs.length - 1;
                    syncBoardAfterSnap = true; // рокировка / взятие на проходе / превращение
                    playSoundForMove(editorMove);
                    updateStatus();
                    autoHintIfNeeded();
                    return;
                }
            }

            // Свободная расстановка: обновляем внутренний движок игры (собираем примерный FEN)
            // Ход передаётся стороне, противоположной передвинутой фигуре
            var nextTurn = piece.charAt(0) === 'w' ? 'b' : 'w';
            var editedPlacement = Chessboard.objToFen(newPos);
            var castlingRights = retainCastlingRights(game.fen(), editedPlacement);
            var newFen = editedPlacement + " " + nextTurn + " " + castlingRights + " - 0 1";
            game.load(newFen);
            historyFENs = [game.fen()];
            currentViewPly = 0;
            playSoundForMove(null);
            updateStatus();
            autoHintIfNeeded();
            return;
        }

        // Режим игры: проверяем правильность хода
        removeHighlights();

        var move = game.move({
            from: source,
            to: target,
            promotion: 'q' // Упрощение: пешки всегда становятся ферзями
        });

        // Ход не по правилам
        if (move === null) return 'snapback';
        
        historyFENs.push(game.fen());
        currentViewPly = historyFENs.length - 1;
        
        playSoundForMove(move);
        
        // --- Таймер: инкремент и старт ---
        clock.addIncrement(move.color);
        clock.startClock();

        updateStatus();

        // Если игра не окончена, бот делает ход
        window.setTimeout(makeBotMove, 250);
    }

    function onMouseoverSquare(square, piece) {
        var highlight = $('#highlightMovesCb').is(':checked');
        var botLevel = parseInt($('#botLevel').val(), 10);
        
        if (!highlight) return;
        
        // Получаем возможные ходы для наведенной клетки
        var moves = game.moves({
            square: square,
            verbose: true
        });

        if (moves.length === 0) return;

        highlightSquare(square); // Подсвечиваем саму фигуру

        // Подсвечиваем все клетки, куда можно сходить
        for (var i = 0; i < moves.length; i++) {
            highlightSquare(moves[i].to);
        }
    }

    function onMouseoutSquare(square, piece) {
        removeHighlights();
    }

    var syncBoardAfterSnap = false;

    function onSnapEnd() {
        var botLevel = parseInt($('#botLevel').val(), 10);
        if (botLevel > 0 || syncBoardAfterSnap) {
            syncBoardAfterSnap = false;
            board.position(game.fen());
        }
    }

    function updateEvalBar(cp, mate) {
        var isWhiteTurn = (game.turn() === 'w');
        var whiteScore = 0;
        var text = "";

        if (mate !== null) {
            // Mate score is from engine's perspective
            var mateIn = parseInt(mate, 10);
            if (!isWhiteTurn) mateIn = -mateIn; // Convert to absolute white perspective
            
            text = (mateIn > 0 ? "M" : "-M") + Math.abs(mateIn);
            whiteScore = (mateIn > 0) ? 1000 : -1000;
        } else if (cp !== null) {
            var scoreCp = parseInt(cp, 10);
            if (!isWhiteTurn) scoreCp = -scoreCp; // Convert to white perspective
            
            text = (scoreCp > 0 ? "+" : "") + (scoreCp / 100).toFixed(1);
            whiteScore = scoreCp;
        } else {
            return;
        }

        // Calculate height percentage
        var percent = 50 + (whiteScore / 15);
        if (percent < 5 && mate === null) percent = 5;
        if (percent > 95 && mate === null) percent = 95;
        if (percent < 0) percent = 0;
        if (percent > 100) percent = 100;

        var isFlipped = (board.orientation() === 'black');
        var whiteBar = $('#evalBarWhite');
        var textEl = $('#evalBarText');

        textEl.text(text);

        // Adjust for flip
        if (isFlipped) {
            whiteBar.css({ bottom: 'auto', top: 0, height: percent + '%' });
        } else {
            whiteBar.css({ top: 'auto', bottom: 0, height: percent + '%' });
        }

        // Adjust text color based on background it sits on
        if (isFlipped ? percent > 90 : percent > 90) {
            textEl.css('color', '#333');
        } else {
            textEl.css('color', '#eaeaea');
        }
    }

    function updateStatus(updateHistory) {
        var isHistoricalPosition = currentViewPly < historyFENs.length - 1;
        var displayedGame = isHistoricalPosition ? new Chess(historyFENs[currentViewPly]) : game;
        var status = '';
        var moveColor = (displayedGame.turn() === 'w') ? 'Белые' : 'Черные';
        var isGameOver = false;
        var overlayText = '';

        if (displayedGame.in_checkmate()) {
            status = 'Мат! ' + moveColor + ' проиграли.';
            isGameOver = true;
            overlayText = 'МАТ!<br><span style="font-size: 20px">' + moveColor + ' проиграли</span>';
            if (!isHistoricalPosition) clock.stopClock();
        } else if (displayedGame.in_draw()) {
            status = 'Ничья!';
            isGameOver = true;
            overlayText = 'НИЧЬЯ';
            if (!isHistoricalPosition) clock.stopClock();
        } else if (isHistoricalPosition) {
            status = (displayedGame.in_check() ? 'Шах! ' : '') + 'Просмотр позиции после хода ' + currentViewPly + '. Ход: ' + moveColor;
        } else {
            if (engine.isThinking) {
                status = 'Бот думает...';
            } else if (parseInt($('#botLevel').val(), 10) > 0) {
                if (game.in_check()) {
                    status = 'Шах! Ход: ' + moveColor;
                } else {
                    status = 'Ход: ' + moveColor;
                }
            } else {
                status = 'Редактор позиций';
            }
        }
        
        $('#gameStatus').text(status);
        updateMaterial(displayedGame);
        highlightCheck(displayedGame);
        if (updateHistory !== false) moveHistoryView.updateMoveHistory();
        
        if (!isHistoricalPosition && isGameOver && !$('#gameOverOverlay').data('dismissed')) {
            $('#gameOverText').html(overlayText);
            $('#gameOverOverlay').css('display', 'flex');
        } else if (isHistoricalPosition || !isGameOver) {
            $('#gameOverOverlay').hide();
            if (!isHistoricalPosition) $('#gameOverOverlay').data('dismissed', false);
        }
    }

    function highlightCheck(positionGame) {
        var position = positionGame || game;
        $('#myBoard .square-55d63').removeClass('in-check');
        if (position.in_check() || position.in_checkmate()) {
            var turn = position.turn();
            var boardState = position.board();
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

    function getPieceThemeUrl(piece) {
        var theme = $('#pieceThemeSelect').val();
        if (theme === 'wikipedia') {
            return 'https://chessboardjs.com/img/chesspieces/wikipedia/' + piece + '.png';
        } else if (theme.startsWith('chesscom_')) {
            var chesscomTheme = theme.split('_')[1];
            return 'https://images.chesscomfiles.com/chess-themes/pieces/' + chesscomTheme + '/150/' + piece.toLowerCase() + '.png';
        } else {
            return 'https://lichess1.org/assets/piece/' + theme + '/' + piece + '.svg';
        }
    }

    function updateMaterial(positionGame) {
        var position = positionGame || game;
        var counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
        var boardStr = position.fen().split(' ')[0];
        for (var i = 0; i < boardStr.length; i++) {
            var char = boardStr[i];
            if (/[pnbrq]/.test(char)) counts.b[char]++;
            else if (/[PNBRQ]/.test(char)) counts.w[char.toLowerCase()]++;
        }

        var start = { q: 1, r: 2, b: 2, n: 2, p: 8 }; // Важен порядок для красивого вывода
        var values = { q: 9, r: 5, b: 3, n: 3, p: 1 };
        
        var capturedByWhiteHTML = '';
        var capturedByBlackHTML = '';
        
        var whiteTotal = 0;
        var blackTotal = 0;
        
        for (var type in start) {
            var missingBlack = start[type] - counts.b[type];
            for (var j = 0; j < missingBlack; j++) {
                capturedByWhiteHTML += '<img class="material-piece" src="' + getPieceThemeUrl('b' + type.toUpperCase()) + '">';
            }
            var missingWhite = start[type] - counts.w[type];
            for (var j = 0; j < missingWhite; j++) {
                capturedByBlackHTML += '<img class="material-piece" src="' + getPieceThemeUrl('w' + type.toUpperCase()) + '">';
            }
            whiteTotal += counts.w[type] * values[type];
            blackTotal += counts.b[type] * values[type];
        }
        
        var diff = whiteTotal - blackTotal;
        var whiteScoreHTML = diff > 0 ? '<span class="material-score">+' + diff + '</span>' : '';
        var blackScoreHTML = diff < 0 ? '<span class="material-score">+' + Math.abs(diff) + '</span>' : '';
        
        var isWhiteBottom = (board.orientation() === 'white');
        
        if (isWhiteBottom) {
            $('#topMaterial').html(capturedByBlackHTML + blackScoreHTML);
            $('#bottomMaterial').html(capturedByWhiteHTML + whiteScoreHTML);
        } else {
            $('#topMaterial').html(capturedByWhiteHTML + whiteScoreHTML);
            $('#bottomMaterial').html(capturedByBlackHTML + blackScoreHTML);
        }
    }

    // Инициализация доски
    var config = {
        draggable: true,
        dropOffBoard: 'trash',
        sparePieces: true,
        position: 'start',
        pieceTheme: getPieceThemeUrl,
        onDragStart: onDragStart,
        onDrop: onDrop,
        onMouseoutSquare: onMouseoutSquare,
        onMouseoverSquare: onMouseoverSquare,
        onSnapEnd: onSnapEnd
    };
    board = Chessboard('myBoard', config);
    updateStatus();

    // История ходов по высоте совпадает с игровым полем доски
    function syncHistoryHeight() {
        var historyEl = $('.history-column');
        var boardEl = $('#myBoard .board-b72b1');
        if (!historyEl.length || !boardEl.length) return;
        historyEl.css({ height: '', marginTop: '' });
        // Если колонки перенеслись друг под друга (узкий экран) — не выравниваем
        if (historyEl.offset().top > boardEl.offset().top + boardEl.outerHeight()) return;
        historyEl.css({
            height: boardEl.outerHeight(),
            marginTop: boardEl.offset().top - historyEl.offset().top
        });
    }
    syncHistoryHeight();

    // --- Элементы управления ---
    $('#flipOrientationBtn').on('click', function() {
        board.flip();
        updateMaterial();
        drawHintArrows();
        clock.updateClockUI();
    });

    $('#startPositionBtn').on('click', function() {
        cancelBotSearch();
        clearArrows();
        currentHints = {};
        board.start();
        game.reset();
        historyFENs = [game.fen()];
        currentViewPly = 0;
        playSound('gameStart');
        clock.applySettings();
        updateStatus();
    });

    $('#newGameBtn').on('click', function() {
        var isNonInitialPosition = game.history().length > 0 || game.fen() !== new Chess().fen();
        if (isNonInitialPosition && !window.confirm('Начать новую партию? Текущая позиция будет сброшена.')) return;

        if (isPuzzleMode) exitPuzzleMode();
        else $('#startPositionBtn').trigger('click');
        $('.tab-btn[data-tab="tab-play"]').trigger('click');
    });

    $('#clearBoardBtn').on('click', function() {
        cancelBotSearch();
        clearArrows();
        currentHints = {};
        board.clear();
        game.clear();
        historyFENs = [game.fen()];
        currentViewPly = 0;
        playSound('gameStart');
        clock.applySettings();
        updateStatus();
    });

    $('#getFenBtn').on('click', function() {
        $('#fenInput').val(board.fen());
    });

    $('#setFenBtn').on('click', function() {
        var fen = $('#fenInput').val().trim();
        var fullFen = fen;
        if (fullFen.split(' ').length === 1) {
             fullFen += " w - - 0 1";
        }
        var candidateGame = new Chess();
        try {
            if (!candidateGame.load(fullFen)) throw new Error('Invalid FEN');
        } catch (error) {
            $('#fenError').text('Некорректная позиция FEN.').show();
            return;
        }

        cancelBotSearch();
    clearArrows();
    currentHints = {};
        $('#fenError').hide();
        game.load(candidateGame.fen());
        board.position(game.fen());
        historyFENs = [game.fen()];
        currentViewPly = 0;
        updateStatus();
    });

    $('#botLevel').on('change', function() {
        cancelBotSearch();
        updateStockfishLevel();
        updateStatus();
        
        var level = parseInt($(this).val(), 10);
        if (level > 0) {
            // Если бот включен и пришла его очередь ходить в зависимости от ориентации доски
            var isEngineTurn = (board.orientation() === 'white' && game.turn() === 'b') || 
                               (board.orientation() === 'black' && game.turn() === 'w');
            
            if (isEngineTurn && !game.game_over()) {
                makeBotMove();
            }
        }
    });

    $('#closeOverlayBtn').on('click', function() {
        $('#gameOverOverlay').hide();
        $('#gameOverOverlay').data('dismissed', true);
    });

    $('#pieceThemeSelect').on('change', function() {
        var currentFen = board.fen();
        var currentOrientation = board.orientation();
        
        // Полностью пересоздаем доску для применения новых картинок
        board.destroy();
        config.position = currentFen;
        config.orientation = currentOrientation;
        board = Chessboard('myBoard', config);
        
        updateMaterial();
        highlightCheck();
    });

    $('#boardThemeSelect').on('change', function() {
        $('body').attr('data-board-theme', $(this).val());
    });
    
    // Применяем начальную тему доски
    $('body').attr('data-board-theme', $('#boardThemeSelect').val());

    // --- Логика редизайна (Темы и Вкладки) ---
    $('#themeToggleBtn').on('click', function() {
        var current = $('body').attr('data-theme');
        var next = current === 'dark' ? 'light' : 'dark';
        $('body').attr('data-theme', next);
    });
    
    // Set default dark theme
    if (!$('body').attr('data-theme')) {
        $('body').attr('data-theme', 'dark');
    }

    $('.tab-btn').on('click', function() {
        $('.tab-btn').removeClass('active').attr('aria-selected', 'false').attr('tabindex', '-1')
            .css('border-bottom', '2px solid transparent').css('font-weight', 'normal');
        $(this).addClass('active').attr('aria-selected', 'true').attr('tabindex', '0')
            .css('border-bottom', '2px solid var(--accent-color)').css('font-weight', 'bold');
        
        $('.tab-content').hide().attr('aria-hidden', 'true');
        $('#' + $(this).data('tab')).css('display', 'flex').attr('aria-hidden', 'false');
    });

    $('.tabs-header').on('keydown', '.tab-btn', function(event) {
        var tabs = $('.tab-btn');
        var index = tabs.index(this);
        if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') index = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = tabs.length - 1;
        else return;

        event.preventDefault();
        tabs.eq(index).trigger('focus').trigger('click');
    });

    // --- Навигация по истории ---
    $('#navFirstBtn').on('click', function() { moveHistoryView.goToPly(0); });
    $('#navPrevBtn').on('click', function() { moveHistoryView.goToPly(currentViewPly - 1); });
    $('#navNextBtn').on('click', function() { moveHistoryView.goToPly(currentViewPly + 1); });
    $('#navLastBtn').on('click', function() { moveHistoryView.goToPly(historyFENs.length - 1); });

    $('#moveHistoryList').on('click', '.move-text', function() {
        var ply = parseInt($(this).data('ply'), 10);
        moveHistoryView.goToPly(ply + 1);
    });

    $('#moveHistoryList').on('keydown', '.move-text', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        moveHistoryView.goToPly(parseInt($(this).data('ply'), 10) + 1);
    });

    // --- Кнопки режима задач ---
    $('#loadPuzzleBtn').on('click', function() {
        loadRandomPuzzle();
    });
    
    $('#exitPuzzleBtn').on('click', function() {
        exitPuzzleMode();
        // Переключаемся обратно на вкладку Игра
        $('.tab-btn[data-tab="tab-play"]').click();
    });

    $('#timerEnableCb, #timerBase, #timerInc').on('change', function() {
        clock.applySettings(true);
    });

    // Инициализируем настройки таймера при загрузке
    clock.applySettings();

    // Делаем доску адаптивной
    $(window).resize(function() {
        board.resize();
        syncHistoryHeight();
        drawHintArrows(); // Перерисовываем стрелки под новый размер
    });

});
