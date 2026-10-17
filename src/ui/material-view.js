import { pieceImageUrl, LOCAL_PIECE_THEME } from './piece-images.js';
import { calculateMaterialBalance } from '../domain/material.js';

export function createMaterialView({ $, eventBus, Chess }) {
    let currentOrientation = 'white';
    let currentPositionGame = null;

    // The set chosen in the settings, read when drawing like the board does: the stored set is
    // announced at start-up before this view exists
    function getPieceThemeUrl(piece) {
        return pieceImageUrl($('#pieceThemeSelect').val() || LOCAL_PIECE_THEME, piece);
    }

    function updateMaterial(positionGame) {
        if (!positionGame) return;

        const balance = calculateMaterialBalance(positionGame);

        let capturedByWhiteHTML = '';
        for (const item of balance.capturedByWhite) {
            for (let j = 0; j < item.count; j++) {
                capturedByWhiteHTML += '<img class="material-piece" src="' + getPieceThemeUrl('b' + item.type.toUpperCase()) + '">';
            }
        }

        let capturedByBlackHTML = '';
        for (const item of balance.capturedByBlack) {
            for (let j = 0; j < item.count; j++) {
                capturedByBlackHTML += '<img class="material-piece" src="' + getPieceThemeUrl('w' + item.type.toUpperCase()) + '">';
            }
        }

        const diff = balance.diff;
        const whiteScoreHTML = diff > 0 ? '<span class="material-score">+' + diff + '</span>' : '';
        const blackScoreHTML = diff < 0 ? '<span class="material-score">+' + Math.abs(diff) + '</span>' : '';

        const isWhiteBottom = (currentOrientation === 'white');

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

    eventBus.on('settings:changed', (payload) => {
        if (payload && payload.pieceTheme && currentPositionGame) {
            updateMaterial(currentPositionGame);
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
