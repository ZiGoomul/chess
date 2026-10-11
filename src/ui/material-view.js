import { pieceImageUrl, LOCAL_PIECE_THEME } from './piece-images.js';

export function createMaterialView({ $, eventBus, Chess }) {
    let currentOrientation = 'white';
    let currentPositionGame = null;
    let currentPieceTheme = LOCAL_PIECE_THEME;

    function getPieceThemeUrl(piece) {
        return pieceImageUrl(currentPieceTheme, piece);
    }

    function updateMaterial(positionGame) {
        if (!positionGame) return;
        var counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
        var boardStr = positionGame.fen().split(' ')[0];
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
        
        var isWhiteBottom = (currentOrientation === 'white');
        
        if (isWhiteBottom) {
            $('#topMaterial').html(capturedByBlackHTML + blackScoreHTML);
            $('#bottomMaterial').html(capturedByWhiteHTML + whiteScoreHTML);
        } else {
            $('#topMaterial').html(capturedByWhiteHTML + whiteScoreHTML);
            $('#bottomMaterial').html(capturedByBlackHTML + blackScoreHTML);
        }
    }

    eventBus.on('board:orientation-changed', ({ orientation }) => {
        currentOrientation = orientation;
        if (currentPositionGame) {
            updateMaterial(currentPositionGame);
        }
    });

    eventBus.on('theme:changed', (payload) => {
        if (payload && payload.pieceTheme) {
            currentPieceTheme = payload.pieceTheme;
            if (currentPositionGame) {
                updateMaterial(currentPositionGame);
            }
        }
    });

    const handlePositionChange = (payload) => {
        if (payload.positionGame) {
            currentPositionGame = payload.positionGame;
        } else if (payload.fen) {
            if (Chess) {
                currentPositionGame = new Chess(payload.fen);
            }
        }
        if (currentPositionGame) {
            updateMaterial(currentPositionGame);
        }
    };

    eventBus.on('game:move-made', handlePositionChange);
    eventBus.on('game:ply-changed', handlePositionChange);

    return {
        updateMaterial,
        getPieceThemeUrl
    };
}
