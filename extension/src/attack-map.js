// Расчёт карты нападений/защит по расстановке фигур.
// Классический скрипт (без export), чтобы его можно было подключить как content script;
// API публикуется в globalThis.ChessHighlighter.
(function (root) {
    'use strict';

    var KNIGHT_STEPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
    var KING_STEPS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    var ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    var FILES = 'abcdefgh';

    function squareName(file, rank) {
        return FILES[file] + (rank + 1);
    }

    function onBoard(file, rank) {
        return file >= 0 && file < 8 && rank >= 0 && rank < 8;
    }

    // pieces: { e4: { color: 'w', type: 'p' }, ... }
    // Возвращает список клеток, которые бьёт фигура (включая клетки со своими фигурами).
    function attackedSquares(pieces, square, piece) {
        var file = FILES.indexOf(square[0]);
        var rank = Number(square[1]) - 1;
        var result = [];

        function step(offsets) {
            for (var i = 0; i < offsets.length; i++) {
                var f = file + offsets[i][0];
                var r = rank + offsets[i][1];
                if (onBoard(f, r)) result.push(squareName(f, r));
            }
        }

        function slide(dirs) {
            for (var i = 0; i < dirs.length; i++) {
                var f = file + dirs[i][0];
                var r = rank + dirs[i][1];
                while (onBoard(f, r)) {
                    var sq = squareName(f, r);
                    result.push(sq);
                    if (pieces[sq]) break;
                    f += dirs[i][0];
                    r += dirs[i][1];
                }
            }
        }

        switch (piece.type) {
            case 'p':
                var dir = piece.color === 'w' ? 1 : -1;
                step([[-1, dir], [1, dir]]);
                break;
            case 'n': step(KNIGHT_STEPS); break;
            case 'k': step(KING_STEPS); break;
            case 'b': slide(BISHOP_DIRS); break;
            case 'r': slide(ROOK_DIRS); break;
            case 'q': slide(ROOK_DIRS); slide(BISHOP_DIRS); break;
        }
        return result;
    }

    // Считает для каждой клетки число атакующих фигур каждого цвета.
    function computeAttackCounts(pieces) {
        var counts = { w: {}, b: {} };
        for (var square in pieces) {
            var piece = pieces[square];
            var targets = attackedSquares(pieces, square, piece);
            for (var i = 0; i < targets.length; i++) {
                counts[piece.color][targets[i]] = (counts[piece.color][targets[i]] || 0) + 1;
            }
        }
        return counts;
    }

    // attacks:  фигуры под боем — { e5: { by: 'w', count: 2 } }
    // defenders: сколько своих фигур защищают фигуру (кроме короля) — { e5: 1 }
    function computeHighlights(pieces) {
        var counts = computeAttackCounts(pieces);
        var attacks = {};
        var defenders = {};
        for (var square in pieces) {
            var piece = pieces[square];
            var enemy = piece.color === 'w' ? 'b' : 'w';
            if (counts[enemy][square]) {
                attacks[square] = { by: enemy, count: counts[enemy][square] };
            }
            if (piece.type !== 'k' && counts[piece.color][square]) {
                defenders[square] = counts[piece.color][square];
            }
        }
        return { attacks: attacks, defenders: defenders };
    }

    root.ChessHighlighter = Object.assign(root.ChessHighlighter || {}, {
        attackedSquares: attackedSquares,
        computeAttackCounts: computeAttackCounts,
        computeHighlights: computeHighlights
    });
})(globalThis);
