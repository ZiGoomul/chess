// Чтение позиции с доски chess.com и правила, где подсветка разрешена.
(function (root) {
    'use strict';

    var FILES = 'abcdefgh';
    var BOARD_SELECTOR = 'wc-chess-board, chess-board';

    // Страницы с живыми партиями и рейтинговыми задачами: любая подсказка там
    // нарушает Fair Play chess.com и может привести к бану аккаунта.
    var BLOCKED_PATHS = [
        /^\/play\/online/,
        /^\/game\/live/,
        /^\/game\/daily/,
        /^\/live/,
        /^\/daily/,
        /^\/tournament/,
        /^\/puzzles\/rated/,
        /^\/puzzles\/rush/,
        /^\/puzzles\/battle/,
        /^\/puzzles$/
    ];

    // Страницы анализа и игры против бота.
    var ALLOWED_PATHS = [
        /^\/analysis/,
        /^\/play\/computer/,
        /^\/game\/(live|daily|computer)\/\d+\/review/,
        /^\/game\/computer/,
        /^\/explorer/,
        /^\/lessons/,
        /^\/practice/,
        /^\/drills/,
        /^\/puzzles\/learning/,
        /^\/openings/
    ];

    // Страница партии: один и тот же адрес и у идущей, и у завершённой игры.
    var GAME_PAGE_PATH = /^\/game\/(live|daily)\/\d+$/;

    // Признаки завершённой партии: кнопка «Game Review» и окно с результатом
    // появляются только после окончания игры.
    var GAME_OVER_SELECTOR = '.game-review-buttons-component, .game-over-modal-shell-container';

    function normalizePath(pathname) {
        return (pathname || '/').replace(/\/+$/, '') || '/';
    }

    function isAllowedPage(pathname) {
        var path = normalizePath(pathname);
        for (var i = 0; i < ALLOWED_PATHS.length; i++) {
            if (ALLOWED_PATHS[i].test(path)) return true;
        }
        for (var j = 0; j < BLOCKED_PATHS.length; j++) {
            if (BLOCKED_PATHS[j].test(path)) return false;
        }
        return false;
    }

    function isHighlightAllowed(pathname, doc) {
        if (isAllowedPage(pathname)) return true;
        return GAME_PAGE_PATH.test(normalizePath(pathname)) &&
            Boolean(doc.querySelector(GAME_OVER_SELECTOR));
    }

    // Класс фигуры chess.com: "piece wp square-52" → { e2: { color: 'w', type: 'p' } }
    function parsePieceClass(className) {
        var tokens = String(className).split(/\s+/);
        var kind = null;
        var square = null;
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            if (/^[wb][pnbrqk]$/.test(token)) kind = token;
            var match = /^square-([1-8])([1-8])$/.exec(token);
            if (match) square = FILES[Number(match[1]) - 1] + match[2];
        }
        if (!kind || !square) return null;
        return { square: square, piece: { color: kind[0], type: kind[1] } };
    }

    function readPieces(boardEl) {
        var pieces = {};
        var nodes = boardEl.querySelectorAll('.piece');
        for (var i = 0; i < nodes.length; i++) {
            // Фигуру, которую сейчас тащат мышью, не учитываем.
            if (nodes[i].classList.contains('dragging')) continue;
            var parsed = parsePieceClass(nodes[i].className);
            if (parsed) pieces[parsed.square] = parsed.piece;
        }
        return pieces;
    }

    function isFlipped(boardEl) {
        return boardEl.classList.contains('flipped');
    }

    function findBoards(doc) {
        return Array.prototype.slice.call(doc.querySelectorAll(BOARD_SELECTOR));
    }

    root.ChessHighlighter = Object.assign(root.ChessHighlighter || {}, {
        isAllowedPage: isAllowedPage,
        isHighlightAllowed: isHighlightAllowed,
        parsePieceClass: parsePieceClass,
        readPieces: readPieces,
        isFlipped: isFlipped,
        findBoards: findBoards
    });
})(globalThis);
